// src/content/adapters/chatgpt.js
// ChatGPT Adapter - Full implementation with strategy chain for resilience

console.log('[AIOS ChatGPT Adapter] Loading adapter');

/**
 * ChatGPT Adapter implementing the required Browser Adapter interface
 * Uses strategy chain pattern for resilient element detection per Adapter Resilience.md
 */
export function createChatGPTAdapter() {
  const providerId = 'chatgpt';
  const version = '1.0.0'; // Will be incremented when UI changes require selector updates
  
  // Strategy chain for finding elements
  const strategies = {
    // Textarea/input field strategies
    inputField: [
      // Strategy 1: Accessibility-based (ARIA)
      () => document.querySelector('textarea[aria-label*="Message"], textarea[role="textbox"]'),
      
      // Strategy 2: Data-testid (stable attributes if available)
      () => document.querySelector('textarea[data-testid="chat-input"], textarea[data-id="chat-input"]'),
      
      // Strategy 3: Placeholder text
      () => document.querySelector('textarea[placeholder*="Message"], textarea[placeholder*="Ask"]'),
      
      // Strategy 4: Structural heuristic (textarea in main chat area)
      () => {
        const mainArea = document.querySelector('main, [role="main"]');
        return mainArea ? mainArea.querySelector('textarea') : null;
      },
      
      // Strategy 5: Last resort - any textarea on page
      () => document.querySelector('textarea')
    ],
    
    // Send button strategies
    sendButton: [
      // Strategy 1: Accessibility-based
      () => document.querySelector('button[aria-label*="Send"], button[aria-label*="send"]'),
      
      // Strategy 2: Data-testid
      () => document.querySelector('button[data-testid="send-button"]'),
      
      // Strategy 3: SVG icon inside button near textarea
      () => {
        const textarea = strategies.inputField[0]();
        if (!textarea) return null;
        const form = textarea.closest('form');
        return form ? form.querySelector('button[type="submit"]') : null;
      },
      
      // Strategy 4: Button with send icon
      () => document.querySelector('button:has(svg[path*="arrow"]), button:has(svg[path*="Arrow"])')
    ],
    
    // New chat button strategies
    newChatButton: [
      // Strategy 1: Accessibility-based
      () => document.querySelector('a[aria-label*="New"], button[aria-label*="New chat"]'),
      
      // Strategy 2: Text content
      () => Array.from(document.querySelectorAll('a, button')).find(el => 
        el.textContent?.toLowerCase().includes('new chat')
      ),
      
      // Strategy 3: Sidebar new chat button (common structure)
      () => document.querySelector('nav a[href*="/c/"], aside button:first-child')
    ],
    
    // Response container strategies
    responseContainer: [
      // Strategy 1: Assistant message with data attribute
      () => document.querySelectorAll('[data-message-author-role="assistant"], article:has([data-message-author-role="assistant"])'),
      
      // Strategy 2: Article elements (ChatGPT structure)
      () => document.querySelectorAll('article[data-message-id]'),
      
      // Strategy 3: Response by class name
      () => document.querySelectorAll('.message-assistant, .response-assistant'),
      
      // Strategy 4: Any element with assistant role
      () => document.querySelectorAll('[role="article"]:last-child, [data-role="assistant"]')
    ],
    
    // Stop generation button strategies
    stopButton: [
      // Strategy 1: Accessibility-based
      () => document.querySelector('button[aria-label*="Stop"], button[aria-label*="stop"]'),
      
      // Strategy 2: Text content
      () => Array.from(document.querySelectorAll('button')).find(el => 
        el.textContent?.toLowerCase().includes('stop')
      ),
      
      // Strategy 3: Icon button near response area
      () => document.querySelector('button svg[path*="square"], button svg[path*="Square"]')?.closest('button')
    ],
    
    // File attachment input strategies
    fileInput: [
      // Strategy 1: Hidden file input
      () => document.querySelector('input[type="file"][accept*="image"], input[type="file"][accept*=".pdf"]'),
      
      // Strategy 2: File input by aria label
      () => document.querySelector('input[type="file"][aria-label*="file"], input[type="file"][aria-label*="upload"]'),
      
      // Strategy 3: Find via attachment button
      () => {
        const attachBtn = strategies.attachButton[0]();
        if (attachBtn && attachBtn.nextElementSibling?.tagName === 'INPUT') {
          return attachBtn.nextElementSibling;
        }
        return null;
      }
    ],
    
    // File attachment button strategies
    attachButton: [
      // Strategy 1: Accessibility-based
      () => document.querySelector('button[aria-label*="Attach"], button[aria-label*="Upload"], button[aria-label*="File"]'),
      
      // Strategy 2: Icon-based (paperclip or similar)
      () => document.querySelector('button:has(svg[path*="clip"]), button:has(svg[path*="paperclip"])'),
      
      // Strategy 3: Near textarea
      () => {
        const textarea = strategies.inputField[0]();
        if (!textarea) return null;
        const container = textarea.closest('form, div');
        return container ? container.querySelector('button:not([type="submit"])') : null;
      }
    ]
  };
  
  /**
   * Find element using strategy chain
   * Tries each strategy in order until one succeeds
   * @param {string} elementType - Key from strategies object
   * @returns {Element|null}
   */
  function findElement(elementType) {
    const elementStrategies = strategies[elementType];
    if (!elementStrategies) {
      console.error(`[AIOS ChatGPT Adapter] Unknown element type: ${elementType}`);
      return null;
    }
    
    for (let i = 0; i < elementStrategies.length; i++) {
      try {
        const element = elementStrategies[i]();
        if (element) {
          console.log(`[AIOS ChatGPT Adapter] Found ${elementType} using strategy ${i + 1}`);
          return element;
        }
      } catch (e) {
        console.warn(`[AIOS ChatGPT Adapter] Strategy ${i + 1} for ${elementType} failed:`, e);
      }
    }
    
    console.warn(`[AIOS ChatGPT Adapter] Could not find ${elementType} after ${elementStrategies.length} strategies`);
    return null;
  }
  
  /**
   * Find multiple elements using strategy chain
   * @param {string} elementType - Key from strategies object
   * @returns {NodeList|Array}
   */
  function findElements(elementType) {
    const elementStrategies = strategies[elementType];
    if (!elementStrategies) {
      return [];
    }
    
    for (let i = 0; i < elementStrategies.length; i++) {
      try {
        const elements = elementStrategies[i]();
        if (elements && elements.length > 0) {
          console.log(`[AIOS ChatGPT Adapter] Found ${elementType} elements using strategy ${i + 1}`);
          return elements;
        }
      } catch (e) {
        console.warn(`[AIOS ChatGPT Adapter] Strategy ${i + 1} for ${elementType} failed:`, e);
      }
    }
    
    return [];
  }
  
  /**
   * Safely set textarea value and trigger events
   * @param {HTMLTextAreaElement} textarea
   * @param {string} value
   */
  function setTextareaValue(textarea, value) {
    if (!textarea) return;
    
    // Set value using native setter to bypass React's synthetic events
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    if (nativeSetter) {
      nativeSetter.call(textarea, value);
    } else {
      textarea.value = value;
    }
    
    // Trigger input event
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  /**
   * Wait for element to appear
   * @param {Function} selectorFn - Function that returns element or null
   * @param {number} timeout - Max time to wait in ms
   * @returns {Promise<Element|null>}
   */
  function waitForElement(selectorFn, timeout = 10000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const check = () => {
        const element = selectorFn();
        if (element) {
          resolve(element);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          resolve(null);
          return;
        }
        
        setTimeout(check, 100);
      };
      
      check();
    });
  }
  
  /**
   * Check if response is still being generated
   * @param {Element} responseElement
   * @returns {boolean}
   */
  function isGenerating(responseElement) {
    if (!responseElement) return false;
    
    // Check for common "generating" indicators
    const isGeneratingClass = responseElement.classList.contains('generating') ||
                              responseElement.classList.contains('streaming') ||
                              responseElement.classList.contains('typing');
    
    // Check for cursor/blinking indicator
    const cursorElement = responseElement.querySelector('.cursor, .typing-indicator, .animate-pulse');
    
    // Check for incomplete code blocks
    const codeBlocks = responseElement.querySelectorAll('pre code');
    let hasIncompleteCode = false;
    codeBlocks.forEach(block => {
      const text = block.textContent;
      if (text.endsWith('```') === false && text.includes('```')) {
        hasIncompleteCode = true;
      }
    });
    
    return isGeneratingClass || cursorElement !== null || hasIncompleteCode;
  }
  
  return {
    providerId,
    
    /**
     * Detect if we're on a supported ChatGPT page
     * @returns {{ supported: boolean, providerId: string, version: string }}
     */
    detect() {
      const inputField = findElement('inputField');
      const isSupported = inputField !== null;
      
      // Try to determine version from page metadata if available
      let detectedVersion = version;
      const metaVersion = document.querySelector('meta[name="version"], meta[property="og:site_version"]');
      if (metaVersion) {
        detectedVersion = metaVersion.getAttribute('content') || version;
      }
      
      console.log(`[AIOS ChatGPT Adapter] Detected: supported=${isSupported}, version=${detectedVersion}`);
      
      return {
        supported: isSupported,
        providerId,
        version: detectedVersion
      };
    },
    
    /**
     * Start a new chat
     * @returns {{ tabId: string, chatId: string, providerId: string }}
     */
    newChat() {
      console.log('[AIOS ChatGPT Adapter] Starting new chat');
      
      const newChatBtn = findElement('newChatButton');
      if (newChatBtn) {
        newChatBtn.click();
        console.log('[AIOS ChatGPT Adapter] Clicked new chat button');
      } else {
        console.warn('[AIOS ChatGPT Adapter] Could not find new chat button');
      }
      
      return {
        tabId: String(window.chrome?.runtime?.id || 'unknown'),
        chatId: `chatgpt_${Date.now()}`,
        providerId
      };
    },
    
    /**
     * Send a prompt to ChatGPT
     * @param {{ tabId: string, chatId: string, providerId: string }} chatHandle
     * @param {string} text
     */
    sendPrompt(chatHandleOrText, text) {
      const actualText = text || chatHandleOrText;
      console.log("[AIOS ChatGPT Adapter] Sending prompt:", actualText.substring(0, 50) + "...");
      
      const textarea = findElement("inputField");
      if (!textarea) {
        console.error("[AIOS ChatGPT Adapter] Cannot send prompt: input field not found");
        return;
      }
      
      // Focus the textarea
      textarea.focus();
      
      // Try multiple ways to set the text
      textarea.value = actualText;
      
      // Simulate typing each character (for React/Vue apps)
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Try execCommand as a fallback
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, actualText);
      } catch (e) {
        console.warn("[AIOS ChatGPT Adapter] execCommand failed", e);
      }
      
      // Update textarea again and ensure events are fired
      setTextareaValue(textarea, actualText);
      
      // Wait a bit, then try to send
      setTimeout(() => {
        const sendBtn = findElement("sendButton");
        
        if (sendBtn) {
          console.log("[AIOS ChatGPT Adapter] Clicking send button (with mouse events)");
          sendBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          sendBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          sendBtn.click();
        }
        
        // Also try Enter key with proper events
        console.log("[AIOS ChatGPT Adapter] Simulating Enter key press");
        textarea.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));
        textarea.dispatchEvent(new KeyboardEvent('keypress', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));
        
      }, 500);
    },
    
    /**
     * Attach files to the chat
     * @param {{ tabId: string, chatId: string, providerId: string }} chatHandle
     * @param {File[]} files - Array of File objects
     */
    attachFiles(chatHandleOrFiles, files) {
      const actualFiles = files || chatHandleOrFiles;
      console.log("[AIOS ChatGPT Adapter] Attaching files:", actualFiles.map((f) => f.name));
      
      if (!actualFiles || actualFiles.length === 0) {
        console.warn("[AIOS ChatGPT Adapter] No files to attach");
        return;
      }
      
      // Strategy 1: Use file input directly
      const fileInput = findElement("fileInput");
      if (fileInput) {
        console.log("[AIOS ChatGPT Adapter] Using direct file input");
        
        // Create a DataTransfer to set files programmatically
        const dataTransfer = new DataTransfer();
        actualFiles.forEach((file) => dataTransfer.items.add(file));
        
        try {
          fileInput.files = dataTransfer.files;
          fileInput.dispatchEvent(new Event("change", { bubbles: true }));
          console.log("[AIOS ChatGPT Adapter] Files attached via file input");
          return;
        } catch (e) {
          console.warn("[AIOS ChatGPT Adapter] Failed to set files on input:", e);
        }
      }
      
      // Strategy 2: Click attach button then use file picker
      const attachBtn = findElement("attachButton");
      if (attachBtn) {
        console.log("[AIOS ChatGPT Adapter] Clicking attach button");
        attachBtn.click();
        
        // Wait for file input to appear after clicking attach button
        setTimeout(() => {
          const appearedFileInput = findElement("fileInput");
          if (appearedFileInput) {
            const dataTransfer = new DataTransfer();
            actualFiles.forEach((file) => dataTransfer.items.add(file));
            
            try {
              appearedFileInput.files = dataTransfer.files;
              appearedFileInput.dispatchEvent(new Event("change", { bubbles: true }));
              console.log("[AIOS ChatGPT Adapter] Files attached after clicking button");
              return;
            } catch (e) {
              console.warn("[AIOS ChatGPT Adapter] Failed to set files after button click:", e);
            }
          }
          
          // Strategy 3: If all else fails, log instructions for manual attachment
          console.warn("[AIOS ChatGPT Adapter] Automatic file attachment failed. Manual attachment required.");
          console.log("[AIOS ChatGPT Adapter] Files that need manual attachment:", actualFiles.map((f) => ({
            name: f.name,
            type: f.type,
            size: f.size
          })));
        }, 500);
        return;
      }
      
      console.error("[AIOS ChatGPT Adapter] Cannot attach files: no attachment mechanism found");
    },
    
    /**
     * Wait for response to finish generating
     * @param {{ tabId: string, chatId: string, providerId: string }} chatHandle
     * @returns {Promise<{ text: string, attachments: any[], status: string }>}
     */
    async waitUntilFinished(chatHandle) {
      console.log('[AIOS ChatGPT Adapter] Waiting for response to finish');
      
      const timeout = 120000; // 2 minutes max
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        const responses = findElements('responseContainer');
        const lastResponse = responses[responses.length - 1];
        
        if (lastResponse && !isGenerating(lastResponse)) {
          const text = lastResponse.textContent?.trim() || '';
          console.log('[AIOS ChatGPT Adapter] Response complete');
          
          return {
            text,
            attachments: [], // TODO: Extract attachments if present
            status: 'complete'
          };
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.warn('[AIOS ChatGPT Adapter] Timeout waiting for response');
      return {
        text: '',
        attachments: [],
        status: 'uncertain'
      };
    },
    
    /**
     * Read the latest response
     * @param {{ tabId: string, chatId: string, providerId: string }} chatHandle
     * @returns {{ text: string, attachments: any[], status: string }}
     */
    readResponse(chatHandle) {
      console.log('[AIOS ChatGPT Adapter] Reading response');
      
      const responses = findElements('responseContainer');
      if (responses.length === 0) {
        console.warn('[AIOS ChatGPT Adapter] No responses found');
        return {
          text: '',
          attachments: [],
          status: 'uncertain'
        };
      }
      
      const lastResponse = responses[responses.length - 1];
      const text = lastResponse.textContent?.trim() || '';
      const isStillGenerating = isGenerating(lastResponse);
      
      return {
        text,
        attachments: [], // TODO: Extract attachments if present
        status: isStillGenerating ? 'incomplete' : 'complete'
      };
    },
    
    /**
     * Stop generation in progress
     * @param {{ tabId: string, chatId: string, providerId: string }} chatHandle
     */
    stopGeneration(chatHandle) {
      console.log('[AIOS ChatGPT Adapter] Stopping generation');
      
      const stopBtn = findElement('stopButton');
      if (stopBtn) {
        stopBtn.click();
        console.log('[AIOS ChatGPT Adapter] Clicked stop button');
      } else {
        console.warn('[AIOS ChatGPT Adapter] Could not find stop button');
      }
    },
    
    /**
     * Rotate to a fresh chat (start new conversation)
     * @param {{ tabId: string, chatId: string, providerId: string }} chatHandle
     * @returns {{ tabId: string, chatId: string, providerId: string }}
     */
    rotate(chatHandle) {
      console.log('[AIOS ChatGPT Adapter] Rotating to new chat');
      return this.newChat();
    },
    
    /**
     * Health check - verify adapter can interact with page
     * @returns {{ ok: boolean, reason?: string }}
     */
    healthCheck() {
      const inputField = findElement('inputField');
      const sendButton = findElement('sendButton');
      
      if (!inputField) {
        return {
          ok: false,
          reason: 'Could not locate message input field after trying all strategies'
        };
      }
      
      if (!sendButton) {
        return {
          ok: false,
          reason: 'Could not locate send button after trying all strategies'
        };
      }
      
      return {
        ok: true,
        reason: 'Chat interface detected and accessible'
      };
    }
  };
}

console.log('[AIOS ChatGPT Adapter] Adapter loaded successfully');
