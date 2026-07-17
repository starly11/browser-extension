// src/content/index.js
// Content script - runs in the context of web pages, hosts the Adapter

console.log('[AIOS Content] Content script loaded');

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
  // For now, return a basic adapter implementation
  // In the future, this will dynamically load from adapters/ folder
  
  if (providerId === 'chatgpt') {
    return createChatGPTAdapter();
  } else if (providerId === 'claude') {
    return createClaudeAdapter();
  } else if (providerId === 'gemini') {
    return createGeminiAdapter();
  }
  
  return null;
}

// Basic ChatGPT adapter
function createChatGPTAdapter() {
  return {
    providerId: 'chatgpt',
    
    detect() {
      return {
        supported: document.querySelector('textarea[placeholder*="Message"]') !== null,
        providerId: 'chatgpt',
        version: 'unknown'
      };
    },
    
    newChat() {
      // Click the new chat button
      const newChatBtn = document.querySelector('button:has-text("New chat"), a:has-text("New chat")');
      if (newChatBtn) {
        newChatBtn.click();
      }
      
      return {
        tabId: String(chrome.runtime.id),
        chatId: Date.now().toString(),
        providerId: 'chatgpt'
      };
    },
    
    sendPrompt(chatHandle, text) {
      const textarea = document.querySelector('textarea[placeholder*="Message"]');
      if (textarea) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Find and click the send button
        const sendBtn = textarea.closest('form')?.querySelector('button[type="submit"]');
        if (sendBtn) {
          sendBtn.click();
        }
      }
    },
    
    attachFiles(chatHandle, files) {
      // ChatGPT file attachment - would need to interact with file input
      console.log('[AIOS Adapter] Attach files not yet implemented for ChatGPT');
    },
    
    waitUntilFinished(chatHandle) {
      // Wait for response to complete
      return new Promise((resolve) => {
        const checkComplete = () => {
          const responseElement = document.querySelector('[data-message-author-role="assistant"]');
          if (responseElement && !responseElement.classList.contains('generating')) {
            resolve({
              text: responseElement.textContent,
              status: 'complete'
            });
          } else {
            setTimeout(checkComplete, 500);
          }
        };
        checkComplete();
      });
    },
    
    readResponse(chatHandle) {
      const responseElements = document.querySelectorAll('[data-message-author-role="assistant"]');
      const lastResponse = responseElements[responseElements.length - 1];
      
      return {
        text: lastResponse ? lastResponse.textContent : '',
        status: 'complete'
      };
    },
    
    stopGeneration(chatHandle) {
      const stopBtn = document.querySelector('button:has-text("Stop generating")');
      if (stopBtn) {
        stopBtn.click();
      }
    },
    
    rotate(chatHandle) {
      // Start a new chat for rotation
      return this.newChat();
    },
    
    healthCheck() {
      const textarea = document.querySelector('textarea[placeholder*="Message"]');
      return {
        ok: textarea !== null,
        reason: textarea ? 'Chat interface detected' : 'Chat interface not found'
      };
    }
  };
}

// Basic Claude adapter
function createClaudeAdapter() {
  return {
    providerId: 'claude',
    
    detect() {
      return {
        supported: document.querySelector('textarea[placeholder*="Message"]') !== null,
        providerId: 'claude',
        version: 'unknown'
      };
    },
    
    newChat() {
      const newChatBtn = document.querySelector('button:has-text("New chat"), a:has-text("New chat")');
      if (newChatBtn) {
        newChatBtn.click();
      }
      
      return {
        tabId: String(chrome.runtime.id),
        chatId: Date.now().toString(),
        providerId: 'claude'
      };
    },
    
    sendPrompt(chatHandle, text) {
      const textarea = document.querySelector('textarea[placeholder*="Message"]');
      if (textarea) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        const sendBtn = document.querySelector('button[aria-label="Send Message"]');
        if (sendBtn) {
          sendBtn.click();
        }
      }
    },
    
    attachFiles(chatHandle, files) {
      console.log('[AIOS Adapter] Attach files not yet implemented for Claude');
    },
    
    waitUntilFinished(chatHandle) {
      return new Promise((resolve) => {
        const checkComplete = () => {
          const responseElement = document.querySelector('.message-assistant:last-child');
          if (responseElement && !responseElement.classList.contains('streaming')) {
            resolve({
              text: responseElement.textContent,
              status: 'complete'
            });
          } else {
            setTimeout(checkComplete, 500);
          }
        };
        checkComplete();
      });
    },
    
    readResponse(chatHandle) {
      const responseElements = document.querySelectorAll('.message-assistant');
      const lastResponse = responseElements[responseElements.length - 1];
      
      return {
        text: lastResponse ? lastResponse.textContent : '',
        status: 'complete'
      };
    },
    
    stopGeneration(chatHandle) {
      const stopBtn = document.querySelector('button:has-text("Stop")');
      if (stopBtn) {
        stopBtn.click();
      }
    },
    
    rotate(chatHandle) {
      return this.newChat();
    },
    
    healthCheck() {
      const textarea = document.querySelector('textarea[placeholder*="Message"]');
      return {
        ok: textarea !== null,
        reason: textarea ? 'Chat interface detected' : 'Chat interface not found'
      };
    }
  };
}

// Basic Gemini adapter
function createGeminiAdapter() {
  return {
    providerId: 'gemini',
    
    detect() {
      return {
        supported: document.querySelector('textarea') !== null,
        providerId: 'gemini',
        version: 'unknown'
      };
    },
    
    newChat() {
      return {
        tabId: String(chrome.runtime.id),
        chatId: Date.now().toString(),
        providerId: 'gemini'
      };
    },
    
    sendPrompt(chatHandle, text) {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        const sendBtn = document.querySelector('button[aria-label="Send"]');
        if (sendBtn) {
          sendBtn.click();
        }
      }
    },
    
    attachFiles(chatHandle, files) {
      console.log('[AIOS Adapter] Attach files not yet implemented for Gemini');
    },
    
    waitUntilFinished(chatHandle) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            text: 'Response ready',
            status: 'complete'
          });
        }, 1000);
      });
    },
    
    readResponse(chatHandle) {
      return {
        text: 'Gemini response',
        status: 'complete'
      };
    },
    
    stopGeneration(chatHandle) {
      console.log('[AIOS Adapter] Stop generation for Gemini');
    },
    
    rotate(chatHandle) {
      return this.newChat();
    },
    
    healthCheck() {
      const textarea = document.querySelector('textarea');
      return {
        ok: textarea !== null,
        reason: textarea ? 'Chat interface detected' : 'Chat interface not found'
      };
    }
  };
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
