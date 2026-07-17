// Site adapters for chat platforms.
// Each provides: name, detect(), getLastUserMessage(), getAllMessages(),
//                getInputElement(), injectText(), getMessageCount()
// Stored on the global window.LocalContextAdapters namespace.

window.LocalContextAdapters = (() => {
  const adapters = [];

  // --- ChatGPT ---
  adapters.push({
    name: 'chatgpt',
    detect() { return /chatgpt\.com|chat\.openai\.com/.test(location.hostname); },
    getLastUserMessage() {
      const msgs = document.querySelectorAll('[data-message-author-role="user"]');
      return msgs.length ? msgs[msgs.length - 1].textContent?.trim() || null : null;
    },
    getAllMessages() {
      const result = [];
      document.querySelectorAll('[data-message-author-role]').forEach(m => {
        const c = m.textContent?.trim();
        if (c) result.push({ role: m.getAttribute('data-message-author-role'), content: c });
      });
      return result;
    },
    getInputElement() {
      return document.getElementById('prompt-textarea') ||
             document.querySelector('[contenteditable="true"][data-id]');
    },
    injectText(text) { return injectIntoEditable(this.getInputElement(), text); },
    getMessageCount() { return document.querySelectorAll('[data-message-author-role]').length; },
  });

  // --- Gemini ---
  adapters.push({
    name: 'gemini',
    detect() { return /gemini\.google\.com/.test(location.hostname); },
    getLastUserMessage() {
      const msgs = document.querySelectorAll('.user-query, [data-role="user"], .query-content');
      return msgs.length ? msgs[msgs.length - 1].textContent?.trim() || null : null;
    },
    getAllMessages() {
      const result = [];
      document.querySelectorAll('.user-query, .model-response, [data-role="user"], [data-role="model"]')
        .forEach(el => {
          const role = el.matches('.user-query, [data-role="user"]') ? 'user' : 'assistant';
          const c = el.textContent?.trim();
          if (c) result.push({ role, content: c });
        });
      return result;
    },
    getInputElement() {
      return document.querySelector('rich-textarea, [contenteditable="true"][aria-label]') ||
             document.querySelector('[contenteditable="true"]');
    },
    injectText(text) { return injectIntoEditable(this.getInputElement(), text); },
    getMessageCount() { return document.querySelectorAll('.user-query, [data-role="user"]').length; },
  });

  // --- Claude ---
  adapters.push({
    name: 'claude',
    detect() { return /claude\.ai/.test(location.hostname); },
    getLastUserMessage() {
      const msgs = document.querySelectorAll('[data-testid="user-message"], .human-message, [data-message-role="user"]');
      return msgs.length ? msgs[msgs.length - 1].textContent?.trim() || null : null;
    },
    getAllMessages() {
      const result = [];
      document.querySelectorAll('[data-testid="user-message"], [data-testid="assistant-message"], .human-message, .ai-message')
        .forEach(el => {
          const isUser = el.matches('[data-testid="user-message"], .human-message');
          const c = el.textContent?.trim();
          if (c) result.push({ role: isUser ? 'user' : 'assistant', content: c });
        });
      return result;
    },
    getInputElement() {
      return document.querySelector('[contenteditable="true"].ProseMirror') ||
             document.querySelector('[contenteditable="true"]') ||
             document.querySelector('div[data-testid="chat-input"] [contenteditable]');
    },
    injectText(text) { return injectIntoEditable(this.getInputElement(), text); },
    getMessageCount() { return document.querySelectorAll('[data-testid="user-message"], .human-message').length; },
  });

  // Shared injection helper
  function injectIntoEditable(el, text) {
    if (!el) return false;
    el.focus();
    el.textContent = '';
    document.execCommand('insertText', false, text);
    return true;
  }

  // Generic fallback
  const fallback = {
    name: 'generic',
    detect() { return true; },
    getLastUserMessage() { return null; },
    getAllMessages() { return []; },
    getInputElement() { return document.querySelector('[contenteditable="true"], textarea, [role="textbox"]'); },
    injectText(text) { return injectIntoEditable(this.getInputElement(), text); },
    getMessageCount() { return 0; },
  };

  return {
    all: adapters,
    fallback,
    detect() {
      for (const a of adapters) if (a.detect()) return a;
      return fallback;
    },
  };
})();
