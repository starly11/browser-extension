// Background service worker — WebSocket connection + Planner orchestration + chat rotation.
// ES module (manifest "type": "module").

import { startPlanning, handlePlannerResponse, checkRotation, plannerSessions } from './planner.js';

const RUNTIME_WS = 'ws://localhost:3333/ws';
const RUNTIME_REST = 'http://localhost:3333';
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;
const PING_INTERVAL_MS = 15000;

let socket = null;
let reconnectDelay = RECONNECT_DELAY_MS;
let reconnectTimer = null;
let pingTimer = null;
let connectedTabs = new Set();

// ---- Connection Management ----

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  console.log('[LocalContext] Connecting to runtime WS...');
  socket = new WebSocket(RUNTIME_WS);

  socket.onopen = () => {
    console.log('[LocalContext] Connected');
    reconnectDelay = RECONNECT_DELAY_MS;
    startPing();
    broadcastStatus('connected');
  };

  socket.onmessage = (event) => handleRuntimeMessage(event.data);

  socket.onclose = (event) => {
    console.log(`[LocalContext] Disconnected (${event.code})`);
    stopPing();
    broadcastStatus('disconnected');
    scheduleReconnect();
  };

  socket.onerror = () => console.log('[LocalContext] WS error');
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }, reconnectDelay);
}

function disconnect() {
  stopPing();
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (socket) { socket.onclose = null; socket.close(); socket = null; }
}

function startPing() {
  stopPing();
  pingTimer = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping', payload: {} }));
    }
  }, PING_INTERVAL_MS);
}

function stopPing() { if (pingTimer) { clearInterval(pingTimer); pingTimer = null; } }

// ---- Runtime Message Handling ----

function handleRuntimeMessage(data) {
  let msg;
  try { msg = JSON.parse(data); } catch { return; }
  if (msg.type === 'pong') return;

  if (msg.type === 'tool_response') {
    forwardToAll({ type: 'tool_result', payload: msg.payload });
  } else if (msg.type === 'error') {
    forwardToAll({ type: 'runtime_error', payload: msg.payload });
  }
}

function forwardToAll(msg) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id && connectedTabs.has(tab.id)) {
        chrome.tabs.sendMessage(tab.id, msg).catch(() => connectedTabs.delete(tab.id));
      }
    }
  });
}

function sendWs(msg) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(msg));
  return true;
}

function broadcastStatus(status) {
  chrome.runtime.sendMessage({ type: 'runtime_status', status }).catch(() => {});
}

// ---- REST API ----

async function restCall(toolName, args = {}, taskId = null) {
  const id = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const res = await fetch(`${RUNTIME_REST}/api/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, args, taskId }),
    });
    return await res.json();
  } catch (err) {
    return { id, success: false, error: err.message, output: '' };
  }
}

async function fetchTools() {
  try {
    const res = await fetch(`${RUNTIME_REST}/api/tools`);
    return (await res.json()).tools || [];
  } catch { return []; }
}

// ---- Content Script Message Handler ----

async function handleContentMessage(msg, sender, sendResponse) {
  // Track connected tabs
  if (sender.tab && !connectedTabs.has(sender.tab.id)) {
    connectedTabs.add(sender.tab.id);
  }

  switch (msg.type) {
    case 'content_ready': {
      sendResponse({ ok: true, connected: socket?.readyState === WebSocket.OPEN });
      break;
    }

    case 'user_message': {
      const tabId = sender.tab?.id;
      const userText = msg.payload?.text || '';
      const platform = msg.platform || 'unknown';

      // Check for chat rotation
      if (tabId) {
        const rotated = await checkRotation(tabId);
        if (rotated) {
          sendResponse({ ok: true, rotated: true });
          break;
        }
      }

      // Start Planner orchestration
      const taskId = `task-${Date.now()}`;
      const tools = await fetchTools();

      // Begin planning loop in background
      startPlanning(taskId, userText, tools).catch(err =>
        console.error('[Planner] startPlanning failed:', err));

      sendResponse({ ok: true, planning: true, task_id: taskId });
      break;
    }

    case 'planner_response': {
      // JSON response from Planner tab — match by sender tabId
      const responseText = msg.payload?.text || '';
      const tabId = sender.tab?.id;
      // Find which session this planner tab belongs to
      for (const [taskId, session] of plannerSessions()) {
        if (session.tabId === tabId) {
          handlePlannerResponse(taskId, responseText);
          break;
        }
      }
      sendResponse({ ok: true });
      break;
    }

    case 'run_tool': {
      const ok = sendWs({
        type: 'tool_request',
        payload: {
          id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: msg.tool,
          args: msg.args || {},
          taskId: msg.task_id || null,
        },
      });
      sendResponse({ ok });
      break;
    }

    case 'run_tool_rest': {
      const result = await restCall(msg.tool, msg.args || {}, msg.task_id || null);
      sendResponse({ ok: true, result });
      break;
    }

    case 'get_status': {
      sendResponse({ connected: socket?.readyState === WebSocket.OPEN });
      break;
    }

    default:
      sendResponse({ ok: false });
  }
}

// ---- Lifecycle ----

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleContentMessage(msg, sender, sendResponse);
  return true; // keep sendResponse alive for async
});

connect();

self.addEventListener('unload', () => disconnect());
