// Content script — injected into chat websites.
// Two modes: "worker" (default — reads user messages, injects responses)
//            "planner" (reads user + assistant messages, auto-submits)
// Thin relay — does NOT think or decide.

(() => {
  let adapter = null;
  let lastMessageCount = 0;
  let mode = 'worker'; // 'worker' | 'planner'
  let lastAssistantText = '';

  function init() {
    adapter = window.LocalContextAdapters.detect();
    console.log('[LocalContext] Platform:', adapter.name, '| Mode:', mode);

    new MutationObserver(checkForNewMessage).observe(document.body, {
      childList: true, subtree: true, characterData: true,
    });

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      switch (msg.type) {
        case 'set_mode':
          mode = msg.mode || 'worker';
          console.log('[LocalContext] Mode:', mode);
          sendResponse({ ok: true });
          break;

        case 'inject_response':
          sendResponse({ ok: injectText(msg.payload.text || msg.payload.output || JSON.stringify(msg.payload)) });
          break;

        case 'inject_and_submit':
          if (injectText(msg.payload.text)) {
            setTimeout(() => clickSend(), 300);
            sendResponse({ ok: true });
          } else {
            sendResponse({ ok: false, error: 'inject failed' });
          }
          break;

        case 'tool_result': {
          const p = msg.payload;
          const text = p.success
            ? `✅ **Tool: ${p.id || ''}**\n\`\`\`\n${p.output}\n\`\`\`\n*(took ${p.durationMs || '?'}ms)*`
            : `❌ **Error**\n${p.error || 'Unknown error'}`;
          sendResponse({ ok: injectText(text) });
          break;
        }

        case 'runtime_error':
          sendResponse({ ok: injectText(`⚠️ Runtime error: ${msg.payload?.error || 'unknown'}`) });
          break;

        case 'get_context':
          sendResponse({
            ok: true,
            context: {
              platform: adapter.name,
              messages: adapter.getAllMessages(),
              messageCount: adapter.getMessageCount(),
            },
          });
          break;

        case 'ping':
          sendResponse({ ok: true });
          break;
      }
    });

    chrome.runtime.sendMessage({ type: 'content_ready', platform: adapter.name });
    checkForNewMessage();
  }

  function checkForNewMessage() {
    const count = adapter.getMessageCount();
    if (count > lastMessageCount) {
      lastMessageCount = count;

      if (mode === 'worker') {
        const text = adapter.getLastUserMessage();
        if (text) {
          chrome.runtime.sendMessage({
            type: 'user_message',
            source: 'worker',
            platform: adapter.name,
            payload: { text, message_index: lastMessageCount },
          });
        }
      }

      if (mode === 'planner') {
        // Capture the latest assistant response (the JSON decision)
        const msgs = adapter.getAllMessages();
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant' && last.content !== lastAssistantText) {
          lastAssistantText = last.content;
          chrome.runtime.sendMessage({
            type: 'planner_response',
            platform: adapter.name,
            payload: { text: last.content, message_index: lastMessageCount },
          });
        }
      }
    }
  }

  function injectText(text) {
    if (!adapter) return false;
    return adapter.injectText(text);
  }

  function clickSend() {
    // Try common send button selectors
    const btn = document.querySelector('[data-testid="send-button"], button[aria-label*="Send"], button[type="submit"], form button:has(svg)');
    if (btn) { btn.click(); return; }
    // Fallback: press Enter in the input
    const input = adapter.getInputElement();
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
