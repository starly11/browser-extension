// src/content/index.js
// Content script - runs in the context of web pages, hosts the Adapter

console.log('[AIOS Content] Content script loaded');

// Import adapters
import { createChatGPTAdapter } from './adapters/chatgpt.js';

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
  
  if (url.includes('chat.openai.com')) {
    return 'chatgpt';
  } else if (url.includes('claude.ai') || url.includes('anthropic.com')) {
    return 'claude';
  } else if (url.includes('gemini.google.com')) {
    return 'gemini';
  }
  
  return null;
}

// Load adapter for provider
async function loadAdapter(providerId) {
  // Dynamically load adapters from separate files
  if (providerId === 'chatgpt') {
    return createChatGPTAdapter();
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
