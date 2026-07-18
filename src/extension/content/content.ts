/// <reference types="chrome" />

import { ChatGPTAdapter } from '../../adapters/chatgpt/adapter.js';
import type { BrowserAdapter, RuntimeMessage } from '../../shared/types.js';

// ==================== Adapter Management ====================

let adapter: BrowserAdapter | null = null;

function getAdapter(): BrowserAdapter | null {
  if (adapter) return adapter;

  // Detect provider
  const url = window.location.href;
  if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
    adapter = new ChatGPTAdapter();
  }

  return adapter;
}

// ==================== Message Handling ====================

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (message.type === 'adapter_instruction') {
    handleAdapterInstruction(message.payload);
    sendResponse({ success: true });
  }
  return true;
});

async function handleAdapterInstruction(instruction: any): Promise<void> {
  const adapter = getAdapter();
  if (!adapter) {
    console.error('[AIOS] No adapter available for this page');
    return;
  }

  try {
    switch (instruction.action) {
      case 'send_prompt': {
        const chatHandle = await getOrCreateChatHandle();
        await adapter.sendPrompt(chatHandle, instruction.text);
        break;
      }

      case 'attach_files': {
        const chatHandle = await getOrCreateChatHandle();
        await adapter.attachFiles(chatHandle, instruction.files);
        break;
      }

      case 'read_response': {
        const chatHandle = await getOrCreateChatHandle();
        const response = await adapter.readResponse(chatHandle);
        sendResultToRuntime('adapter_result', { action: 'read_response', result: response });
        break;
      }

      case 'wait_until_finished': {
        const chatHandle = await getOrCreateChatHandle();
        const response = await adapter.waitUntilFinished(chatHandle);
        sendResultToRuntime('adapter_result', { action: 'response_ready', result: response });
        break;
      }

      case 'stop_generation': {
        const chatHandle = await getOrCreateChatHandle();
        await adapter.stopGeneration(chatHandle);
        break;
      }

      case 'health_check': {
        const result = await adapter.healthCheck();
        sendResultToRuntime('adapter_result', { action: 'health_check', result });
        break;
      }

      default:
        console.error('[AIOS] Unknown adapter instruction:', instruction.action);
    }
  } catch (err: any) {
    console.error('[AIOS] Adapter error:', err);
    sendResultToRuntime('adapter_error', { action: instruction.action, error: err.message });
  }
}

// ==================== Chat Handle Management ====================

let currentChatHandle: any = null;

async function getOrCreateChatHandle(): Promise<any> {
  if (currentChatHandle) return currentChatHandle;

  const adapter = getAdapter();
  if (!adapter) {
    throw new Error('No adapter available');
  }

  // Try to get the current chat
  const response = await adapter.readResponse({ tabId: 0, chatId: '', providerId: '' });
  if (response.text) {
    // We have a response, so we're in a chat
    currentChatHandle = { tabId: 0, chatId: Date.now().toString(), providerId: adapter.getManifest().providerId };
  } else {
    // Start a new chat
    currentChatHandle = await adapter.newChat();
  }

  return currentChatHandle;
}

// ==================== Communication ====================

function sendResultToRuntime(type: string, payload: any): void {
  chrome.runtime.sendMessage({
    type,
    payload,
  });
}

// ==================== Initialization ====================

console.log('[AIOS] Content script loaded');

// Run health check on load
setTimeout(async () => {
  const adapter = getAdapter();
  if (adapter) {
    const result = await adapter.healthCheck();
    if (result.ok) {
      console.log('[AIOS] Adapter health check passed');
    } else {
      console.warn('[AIOS] Adapter health check failed:', result.reason);
    }
  }
}, 1000);

// Listen for page changes (SPA navigation)
// ChatGPT uses client-side routing
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Page changed - re-check adapter
    adapter = null;
    console.log('[AIOS] Page changed, resetting adapter');
  }
}).observe(document, { subtree: true, childList: true });
