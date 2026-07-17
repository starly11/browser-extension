// src/content/index.js
// Content script - runs in the context of web pages, hosts the Adapter

console.log('[AIOS Content] Content script loaded');

// Import adapters
import { createChatGPTAdapter } from './adapters/chatgpt.js';
// Expose adapter to the page context for debugging


window.aiosAdapter = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[AIOS Content] Received message:', message);

  switch (message.type) {
    case 'RELAY_TO_ADAPTER':
      // Forward instruction to the adapter
      handleAdapterInstruction(message.instruction);
      sendResponse({ success: true });
      break;

    default:
      console.warn('[AIOS Content] Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep channel open for async response
});

// Handle instructions from Runtime (via background)
async function handleAdapterInstruction(instruction) {
  console.log('[AIOS Content] Processing instruction:', instruction);

  // Detect which provider we're on
  const providerId = detectProvider(window.location.href);

  if (!providerId) {
    console.error('[AIOS Content] Unsupported provider');
    return;
  }

  // Load the appropriate adapter
  const adapter = await loadAdapter(providerId);

  if (!adapter) {
    console.error('[AIOS Content] Failed to load adapter for provider:', providerId);
    return;
  }

  // Process the instruction based on its type
  switch (instruction.action) {
    case 'SEND_PROMPT':
      await handleSendPrompt(adapter, instruction);
      break;

    case 'ATTACH_FILES':
      await handleAttachFiles(adapter, instruction);
      break;

    case 'READ_RESPONSE':
      await handleReadResponse(adapter, instruction);
      break;

    case 'STOP_GENERATION':
      await handleStopGeneration(adapter, instruction);
      break;

    case 'ROTATE_CHAT':
      await handleRotateChat(adapter, instruction);
      break;

    default:
      console.warn('[AIOS Content] Unknown instruction action:', instruction.action);
  }
}

// Detect provider from URL
function detectProvider(url) {
  if (!url) return null;

  // Updated to support both the modern chatgpt.com domain and legacy domain
  if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
    return 'chatgpt';
  } else if (url.includes('claude.ai') || url.includes('anthropic.com')) {
    return 'claude';
  } else if (url.includes('gemini.google.com')) {
    return 'gemini';
  }

  return null;
}

// Load adapter for provider and expose it globally
async function loadAdapter(providerId) {
  // Dynamically load adapters from separate files
  if (providerId === 'chatgpt') {
    const adapter = createChatGPTAdapter();
    window.aiosAdapter = adapter; // Expose to page context for debugging
    console.log('[AIOS Content] ChatGPT adapter loaded and exposed to window.aiosAdapter');
    return adapter;
  } else if (providerId === 'claude') {
    // TODO: Create claude adapter in separate file
    console.warn('[AIOS Content] Claude adapter not yet implemented as separate module');
    return null;
  } else if (providerId === 'gemini') {
    // TODO: Create gemini adapter in separate file
    console.warn('[AIOS Content] Gemini adapter not yet implemented as separate module');
    return null;
  }

  return null;
}

// Helper functions for each instruction type
async function handleSendPrompt(adapter, instruction) {
  try {
    await adapter.sendPrompt(instruction.prompt);
  } catch (e) {
    console.error('[AIOS Content] Error sending prompt:', e);
  }
}

async function handleAttachFiles(adapter, instruction) {
  try {
    await adapter.attachFiles(instruction.files);
  } catch (e) {
    console.error('[AIOS Content] Error attaching files:', e);
  }
}

async function handleReadResponse(adapter, instruction) {
  try {
    const response = await adapter.readResponse();
    sendAdapterResultToRuntime(instruction.taskId, { response });
  } catch (e) {
    console.error('[AIOS Content] Error reading response:', e);
    sendAdapterResultToRuntime(instruction.taskId, { error: e.message });
  }
}

async function handleStopGeneration(adapter, instruction) {
  try {
    await adapter.stopGeneration();
  } catch (e) {
    console.error('[AIOS Content] Error stopping generation:', e);
  }
}

async function handleRotateChat(adapter, instruction) {
  try {
    await adapter.rotate();
  } catch (e) {
    console.error('[AIOS Content] Error rotating chat:', e);
  }
}

// Send adapter result back to Runtime
function sendAdapterResultToRuntime(taskId, result) {
  chrome.runtime.sendMessage({
    type: 'ADAPTER_RESULT',
    taskId: taskId,
    tabId: String(chrome.runtime.id),
    result: result
  });
}

console.log('[AIOS Content] Content script initialized');

// --- DEBUG SECTION: Expose methods to extension console context ---
window.__debug_detectProvider = detectProvider;
window.__debug_loadAdapter = loadAdapter;
window.__debug_createChatGPTAdapter = createChatGPTAdapter;
// -----------------------------------------------------------------

// Production: Intercept user actions and route through Runtime
async function initializeProductionMode() {
  const providerId = detectProvider(window.location.href);
  if (!providerId) return;

  const adapter = await loadAdapter(providerId);
  if (!adapter) return;

  console.log('[AIOS Content] Production mode initialized for:', providerId);

  // Intercept ChatGPT send button clicks
  if (providerId === 'chatgpt') {
    interceptChatGPTSends(adapter);
  }
}

// Intercept ChatGPT message sends
function interceptChatGPTSends(adapter) {
  // Monitor for send button clicks and form submissions
  const observeSendButton = () => {
    const sendButton = document.querySelector('button[data-testid="send-button"]');
    if (sendButton) {
      sendButton.addEventListener('click', async (e) => {
        console.log('[AIOS Content] Intercepted ChatGPT send');
        
        // Get the prompt from the textarea
        const textarea = document.querySelector('textarea[aria-label*="Message"]');
        if (textarea && textarea.value.trim()) {
          const prompt = textarea.value;
          
          // Send to Runtime for processing before letting ChatGPT handle it
          await sendUserActionToRuntime({
            action: 'USER_SEND_PROMPT',
            prompt: prompt,
            providerId: 'chatgpt'
          });
        }
      });
    }
  };

  // Observe DOM for send button (it may be dynamically loaded)
  const observer = new MutationObserver(() => {
    observeSendButton();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  observeSendButton(); // Initial check
}

// Send user action to Runtime via background
async function sendUserActionToRuntime(actionData) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'USER_ACTION',
      payload: actionData,
      tabId: String(chrome.runtime.id)
    }, (response) => {
      resolve(response);
    });
  });
}

// Start production mode
initializeProductionMode();