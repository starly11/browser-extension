(() => {
  // src/content/adapters/chatgpt.js
  console.log("[AIOS ChatGPT Adapter] Loading adapter");
  function createChatGPTAdapter() {
    const providerId = "chatgpt";
    const version = "1.0.0";
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
          return mainArea ? mainArea.querySelector("textarea") : null;
        },
        // Strategy 5: Last resort - any textarea on page
        () => document.querySelector("textarea")
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
          const form = textarea.closest("form");
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
        () => Array.from(document.querySelectorAll("a, button")).find(
          (el) => el.textContent?.toLowerCase().includes("new chat")
        ),
        // Strategy 3: Sidebar new chat button (common structure)
        () => document.querySelector('nav a[href*="/c/"], aside button:first-child')
      ],
      // Response container strategies
      responseContainer: [
        // Strategy 1: Assistant message with data attribute
        () => document.querySelectorAll('[data-message-author-role="assistant"], article:has([data-message-author-role="assistant"])'),
        // Strategy 2: Article elements (ChatGPT structure)
        () => document.querySelectorAll("article[data-message-id]"),
        // Strategy 3: Response by class name
        () => document.querySelectorAll(".message-assistant, .response-assistant"),
        // Strategy 4: Any element with assistant role
        () => document.querySelectorAll('[role="article"]:last-child, [data-role="assistant"]')
      ],
      // Stop generation button strategies
      stopButton: [
        // Strategy 1: Accessibility-based
        () => document.querySelector('button[aria-label*="Stop"], button[aria-label*="stop"]'),
        // Strategy 2: Text content
        () => Array.from(document.querySelectorAll("button")).find(
          (el) => el.textContent?.toLowerCase().includes("stop")
        ),
        // Strategy 3: Icon button near response area
        () => document.querySelector('button svg[path*="square"], button svg[path*="Square"]')?.closest("button")
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
          if (attachBtn && attachBtn.nextElementSibling?.tagName === "INPUT") {
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
          const container = textarea.closest("form, div");
          return container ? container.querySelector('button:not([type="submit"])') : null;
        }
      ]
    };
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
    function setTextareaValue(textarea, value) {
      if (!textarea) return;
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      if (nativeSetter) {
        nativeSetter.call(textarea, value);
      } else {
        textarea.value = value;
      }
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function waitForElement(selectorFn, timeout = 1e4) {
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
    function isGenerating(responseElement) {
      if (!responseElement) return false;
      const isGeneratingClass = responseElement.classList.contains("generating") || responseElement.classList.contains("streaming") || responseElement.classList.contains("typing");
      const cursorElement = responseElement.querySelector(".cursor, .typing-indicator, .animate-pulse");
      const codeBlocks = responseElement.querySelectorAll("pre code");
      let hasIncompleteCode = false;
      codeBlocks.forEach((block) => {
        const text = block.textContent;
        if (text.endsWith("```") === false && text.includes("```")) {
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
        const inputField = findElement("inputField");
        const isSupported = inputField !== null;
        let detectedVersion = version;
        const metaVersion = document.querySelector('meta[name="version"], meta[property="og:site_version"]');
        if (metaVersion) {
          detectedVersion = metaVersion.getAttribute("content") || version;
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
        console.log("[AIOS ChatGPT Adapter] Starting new chat");
        const newChatBtn = findElement("newChatButton");
        if (newChatBtn) {
          newChatBtn.click();
          console.log("[AIOS ChatGPT Adapter] Clicked new chat button");
        } else {
          console.warn("[AIOS ChatGPT Adapter] Could not find new chat button");
        }
        return {
          tabId: String(window.chrome?.runtime?.id || "unknown"),
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
        textarea.focus();
        textarea.value = actualText;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.dispatchEvent(new Event("change", { bubbles: true }));
        try {
          document.execCommand("selectAll", false, null);
          document.execCommand("insertText", false, actualText);
        } catch (e) {
          console.warn("[AIOS ChatGPT Adapter] execCommand failed", e);
        }
        setTextareaValue(textarea, actualText);
        setTimeout(() => {
          const sendBtn = findElement("sendButton");
          if (sendBtn) {
            console.log("[AIOS ChatGPT Adapter] Clicking send button (with mouse events)");
            sendBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            sendBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
            sendBtn.click();
          }
          console.log("[AIOS ChatGPT Adapter] Simulating Enter key press");
          textarea.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          }));
          textarea.dispatchEvent(new KeyboardEvent("keypress", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          }));
          textarea.dispatchEvent(new KeyboardEvent("keyup", {
            key: "Enter",
            code: "Enter",
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
        const fileInput = findElement("fileInput");
        if (fileInput) {
          console.log("[AIOS ChatGPT Adapter] Using direct file input");
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
        const attachBtn = findElement("attachButton");
        if (attachBtn) {
          console.log("[AIOS ChatGPT Adapter] Clicking attach button");
          attachBtn.click();
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
        console.log("[AIOS ChatGPT Adapter] Waiting for response to finish");
        const timeout = 12e4;
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
          const responses = findElements("responseContainer");
          const lastResponse = responses[responses.length - 1];
          if (lastResponse && !isGenerating(lastResponse)) {
            const text = lastResponse.textContent?.trim() || "";
            console.log("[AIOS ChatGPT Adapter] Response complete");
            return {
              text,
              attachments: [],
              // TODO: Extract attachments if present
              status: "complete"
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        console.warn("[AIOS ChatGPT Adapter] Timeout waiting for response");
        return {
          text: "",
          attachments: [],
          status: "uncertain"
        };
      },
      /**
       * Read the latest response
       * @param {{ tabId: string, chatId: string, providerId: string }} chatHandle
       * @returns {{ text: string, attachments: any[], status: string }}
       */
      readResponse(chatHandle) {
        console.log("[AIOS ChatGPT Adapter] Reading response");
        const responses = findElements("responseContainer");
        if (responses.length === 0) {
          console.warn("[AIOS ChatGPT Adapter] No responses found");
          return {
            text: "",
            attachments: [],
            status: "uncertain"
          };
        }
        const lastResponse = responses[responses.length - 1];
        const text = lastResponse.textContent?.trim() || "";
        const isStillGenerating = isGenerating(lastResponse);
        return {
          text,
          attachments: [],
          // TODO: Extract attachments if present
          status: isStillGenerating ? "incomplete" : "complete"
        };
      },
      /**
       * Stop generation in progress
       * @param {{ tabId: string, chatId: string, providerId: string }} chatHandle
       */
      stopGeneration(chatHandle) {
        console.log("[AIOS ChatGPT Adapter] Stopping generation");
        const stopBtn = findElement("stopButton");
        if (stopBtn) {
          stopBtn.click();
          console.log("[AIOS ChatGPT Adapter] Clicked stop button");
        } else {
          console.warn("[AIOS ChatGPT Adapter] Could not find stop button");
        }
      },
      /**
       * Rotate to a fresh chat (start new conversation)
       * @param {{ tabId: string, chatId: string, providerId: string }} chatHandle
       * @returns {{ tabId: string, chatId: string, providerId: string }}
       */
      rotate(chatHandle) {
        console.log("[AIOS ChatGPT Adapter] Rotating to new chat");
        return this.newChat();
      },
      /**
       * Health check - verify adapter can interact with page
       * @returns {{ ok: boolean, reason?: string }}
       */
      healthCheck() {
        const inputField = findElement("inputField");
        const sendButton = findElement("sendButton");
        if (!inputField) {
          return {
            ok: false,
            reason: "Could not locate message input field after trying all strategies"
          };
        }
        if (!sendButton) {
          return {
            ok: false,
            reason: "Could not locate send button after trying all strategies"
          };
        }
        return {
          ok: true,
          reason: "Chat interface detected and accessible"
        };
      }
    };
  }
  console.log("[AIOS ChatGPT Adapter] Adapter loaded successfully");

  // src/content/index.js
  console.log("[AIOS Content] Content script loaded");
  window.aiosAdapter = null;
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[AIOS Content] Received message:", message);
    switch (message.type) {
      case "RELAY_TO_ADAPTER":
        handleAdapterInstruction(message.instruction);
        sendResponse({ success: true });
        break;
      default:
        console.warn("[AIOS Content] Unknown message type:", message.type);
        sendResponse({ error: "Unknown message type" });
    }
    return true;
  });
  async function handleAdapterInstruction(instruction) {
    console.log("[AIOS Content] Processing instruction:", instruction);
    const providerId = detectProvider(window.location.href);
    if (!providerId) {
      console.error("[AIOS Content] Unsupported provider");
      return;
    }
    const adapter = await loadAdapter(providerId);
    if (!adapter) {
      console.error("[AIOS Content] Failed to load adapter for provider:", providerId);
      return;
    }
    switch (instruction.action) {
      case "SEND_PROMPT":
        await handleSendPrompt(adapter, instruction);
        break;
      case "ATTACH_FILES":
        await handleAttachFiles(adapter, instruction);
        break;
      case "READ_RESPONSE":
        await handleReadResponse(adapter, instruction);
        break;
      case "STOP_GENERATION":
        await handleStopGeneration(adapter, instruction);
        break;
      case "ROTATE_CHAT":
        await handleRotateChat(adapter, instruction);
        break;
      default:
        console.warn("[AIOS Content] Unknown instruction action:", instruction.action);
    }
  }
  function detectProvider(url) {
    if (!url) return null;
    if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) {
      return "chatgpt";
    } else if (url.includes("claude.ai") || url.includes("anthropic.com")) {
      return "claude";
    } else if (url.includes("gemini.google.com")) {
      return "gemini";
    }
    return null;
  }
  async function loadAdapter(providerId) {
    if (providerId === "chatgpt") {
      const adapter = createChatGPTAdapter();
      window.aiosAdapter = adapter;
      console.log("[AIOS Content] ChatGPT adapter loaded and exposed to window.aiosAdapter");
      return adapter;
    } else if (providerId === "claude") {
      console.warn("[AIOS Content] Claude adapter not yet implemented as separate module");
      return null;
    } else if (providerId === "gemini") {
      console.warn("[AIOS Content] Gemini adapter not yet implemented as separate module");
      return null;
    }
    return null;
  }
  async function handleSendPrompt(adapter, instruction) {
    try {
      await adapter.sendPrompt(instruction.prompt);
    } catch (e) {
      console.error("[AIOS Content] Error sending prompt:", e);
    }
  }
  async function handleAttachFiles(adapter, instruction) {
    try {
      await adapter.attachFiles(instruction.files);
    } catch (e) {
      console.error("[AIOS Content] Error attaching files:", e);
    }
  }
  async function handleReadResponse(adapter, instruction) {
    try {
      const response = await adapter.readResponse();
      sendAdapterResultToRuntime(instruction.taskId, { response });
    } catch (e) {
      console.error("[AIOS Content] Error reading response:", e);
      sendAdapterResultToRuntime(instruction.taskId, { error: e.message });
    }
  }
  async function handleStopGeneration(adapter, instruction) {
    try {
      await adapter.stopGeneration();
    } catch (e) {
      console.error("[AIOS Content] Error stopping generation:", e);
    }
  }
  async function handleRotateChat(adapter, instruction) {
    try {
      await adapter.rotate();
    } catch (e) {
      console.error("[AIOS Content] Error rotating chat:", e);
    }
  }
  function sendAdapterResultToRuntime(taskId, result) {
    chrome.runtime.sendMessage({
      type: "ADAPTER_RESULT",
      taskId,
      tabId: String(chrome.runtime.id),
      result
    });
  }
  console.log("[AIOS Content] Content script initialized");
  window.__debug_detectProvider = detectProvider;
  window.__debug_loadAdapter = loadAdapter;
  window.__debug_createChatGPTAdapter = createChatGPTAdapter;
})();
