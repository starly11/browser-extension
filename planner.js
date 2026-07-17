// Planner orchestration — manages hidden Planner tabs and the tool-execution loop.
// Imported by background.js (ES module service worker).

const PLANNER_URL = 'https://chatgpt.com/';
const CHAT_ROTATION_LIMIT = 80; // messages before rotation
const TOKEN_ROTATION_LIMIT = 150000; // approximate token limit

// Active planner sessions: taskId → { tabId, platform, history, state }
const sessions = new Map();

/** Expose sessions for tab ID lookups */
export function plannerSessions() { return sessions; }

// Message counts per tab for rotation tracking: tabId → count
const messageCounts = new Map();

/** Get or create a Planner tab for a task. Returns tabId. */
export async function getPlannerTab(taskId) {
  if (sessions.has(taskId)) {
    const s = sessions.get(taskId);
    // Verify tab still exists
    try {
      await chrome.tabs.get(s.tabId);
      return s.tabId;
    } catch {
      sessions.delete(taskId);
    }
  }

  // Create hidden Planner tab
  const tab = await chrome.tabs.create({
    url: PLANNER_URL,
    active: false,
    pinned: false,
  });

  sessions.set(taskId, { tabId: tab.id, platform: 'chatgpt', history: [], state: 'starting' });
  console.log(`[Planner] Created tab ${tab.id} for task ${taskId}`);

  // Set content script to planner mode (detects AI responses, not user messages)
  // Retry a few times since the content script may not be injected yet
  for (let i = 0; i < 10; i++) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'set_mode', mode: 'planner' });
      console.log(`[Planner] Tab ${tab.id} set to planner mode`);
      break;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return tab.id;
}

/** Start the planning loop for a user request. */
export async function startPlanning(taskId, userRequest, tools) {
  const tabId = await getPlannerTab(taskId);
  const session = sessions.get(taskId);
  session.state = 'planning';
  session.history = [];

  // Inject system prompt + user request + tools into Planner
  const prompt = buildPlannerPrompt(userRequest, tools, []);
  await injectAndSubmit(tabId, prompt);
}

/** Handle a JSON response from the Planner tab. */
export async function handlePlannerResponse(taskId, responseText) {
  const session = sessions.get(taskId);
  if (!session) return;

  let decision;
  try {
    // Extract JSON from response (may be wrapped in markdown fences)
    const json = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    decision = JSON.parse(json);
  } catch {
    console.warn('[Planner] Failed to parse JSON from planner response');
    // Re-inject with error guidance
    await injectAndSubmit(session.tabId,
      'Your last response was not valid JSON. Output ONLY the JSON object. No markdown, no prose.\n\n' +
      buildPlannerPrompt('', [], session.history));
    return;
  }

  if (decision.done) {
    // Planner finished — forward final message to Worker tab
    session.state = 'done';
    forwardToWorker(taskId, decision.message || 'Task complete.');
    sessions.delete(taskId);
    return;
  }

  // Execute tool actions
  const results = [];
  for (const action of (decision.actions || [])) {
    const result = await executeToolViaRuntime(action.tool, action.args || {}, taskId);
    results.push({ action, result });
    session.history.push({ tool: action.tool, args: action.args, result });
  }

  // Send results back to Planner for next iteration
  const tools = await fetchAvailableTools();
  const context = buildPlannerPrompt('', tools, session.history);
  await injectAndSubmit(session.tabId, context);
}

/** Chat rotation: check if a worker tab needs rotation. */
export async function checkRotation(tabId) {
  const count = (messageCounts.get(tabId) || 0) + 1;
  messageCounts.set(tabId, count);

  if (count >= CHAT_ROTATION_LIMIT) {
    console.log(`[Rotation] Tab ${tabId} at ${count} messages — rotating`);
    await rotateChat(tabId);
    return true;
  }
  return false;
}

// ---- Internal Helpers ----

function buildPlannerPrompt(userRequest, tools, history) {
  const toolsDesc = (tools || []).map(t =>
    `- **${t.name}**: ${t.description || 'No description'}`).join('\n');

  const historyStr = history.length === 0 ? '(no previous actions)' :
    history.map((h, i) =>
      `${i + 1}. Tool: ${h.tool}(${JSON.stringify(h.args)}) → ${h.result.success ? 'OK: ' + h.result.output : 'ERROR: ' + (h.result.error || '')}`
    ).join('\n');

  let prompt = `## LocalContext Planner

**YOUR ONLY ROLE:** Decide which tool to run next. Output JSON only.

**User request:** ${userRequest || '(continuation — see history below)'}

**Available tools:**
${toolsDesc}

**Previous actions:**
${historyStr}

**Output format:**
If more tools needed: {"done":false,"actions":[{"tool":"name","args":{},"reason":"why"}]}
If done: {"done":true,"message":"summary for the user"}

Output ONLY the JSON object. No markdown, no prose.`;

  return prompt;
}

async function injectAndSubmit(tabId, text) {
  await chrome.tabs.sendMessage(tabId, {
    type: 'inject_and_submit',
    payload: { text },
  }).catch(() => {
    console.warn('[Planner] Failed to inject into planner tab — tab may not be ready');
  });
}

async function executeToolViaRuntime(tool, args, taskId) {
  const id = `planner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    const res = await fetch(`http://localhost:3333/api/tools/${tool}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, args, taskId }),
    });
    return await res.json();
  } catch (err) {
    return { id, success: false, error: err.message, output: '', durationMs: 0 };
  }
}

async function fetchAvailableTools() {
  try {
    const res = await fetch('http://localhost:3333/api/tools');
    const data = await res.json();
    return data.tools || [];
  } catch {
    return [];
  }
}

function forwardToWorker(taskId, message) {
  // Broadcast to all connected worker tabs
  chrome.runtime.sendMessage({
    type: 'inject_response',
    target: 'worker',
    task_id: taskId,
    payload: { text: message },
  }).catch(() => {});
}

async function rotateChat(tabId) {
  // Get current context
  let context = { messages: [] };
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'get_context' });
    if (res?.context) context = res.context;
  } catch { /* tab may be gone */ }

  // Open new chat tab (same platform)
  const tab = await chrome.tabs.create({
    url: PLANNER_URL,
    active: false,
  });

  // Inject context summary into new tab
  const summary = context.messages.slice(-5).map(m =>
    `[${m.role}]: ${m.content?.slice(0, 200)}`).join('\n\n');

  setTimeout(async () => {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'inject_and_submit',
      payload: {
        text: `[CONTEXT FROM PREVIOUS CHAT — continue from here]\n\n${summary}`,
      },
    }).catch(() => {});
  }, 3000);

  messageCounts.set(tab.id, 0);
  messageCounts.delete(tabId);
}
