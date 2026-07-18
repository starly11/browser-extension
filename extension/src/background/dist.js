"use strict";
(() => {
  // src/background/index.js
  var RUNTIME_WS_URL = "ws://127.0.0.1:8765";
  var AUTH_TOKEN = "aios-local-token";
  var wsConnection = null;
  var isConnected = false;
  var pendingMessages = [];
  async function connectToRuntime() {
    if (wsConnection) {
      wsConnection.close();
    }
    return new Promise((resolve, reject) => {
      try {
        wsConnection = new WebSocket(RUNTIME_WS_URL);
        wsConnection.onopen = () => {
          console.log("[AIOS Background] Connected to Runtime");
          isConnected = true;
          const authMessage = {
            type: "AUTH_REQUEST",
            id: generateId(),
            taskId: null,
            payload: { token: AUTH_TOKEN },
            ts: (/* @__PURE__ */ new Date()).toISOString()
          };
          wsConnection.send(JSON.stringify(authMessage));
          resolve();
        };
        wsConnection.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleMessageFromRuntime(message);
          } catch (e) {
            console.error("[AIOS Background] Failed to parse Runtime message:", e);
          }
        };
        wsConnection.onerror = (error) => {
          console.error("[AIOS Background] WebSocket error:", error);
          isConnected = false;
          reject(error);
        };
        wsConnection.onclose = () => {
          console.log("[AIOS Background] Disconnected from Runtime");
          isConnected = false;
          wsConnection = null;
          setTimeout(connectToRuntime, 5e3);
        };
      } catch (e) {
        console.error("[AIOS Background] Failed to create WebSocket:", e);
        reject(e);
      }
    });
  }
  function handleMessageFromRuntime(message) {
    console.log("[AIOS Background] Received from Runtime:", JSON.stringify(message, null, 2));
    switch (message.type) {
      case "AUTH_RESPONSE":
        console.log("[AIOS Background] Saved session token:", message.payload.token);
        self.activeAuthToken = message.payload.token;
        break;
      case "RELAY_TO_ADAPTER":
        const { tabId, instruction } = message.payload;
        chrome.tabs.sendMessage(tabId, {
          type: "RELAY_TO_ADAPTER",
          instruction
        }).catch((err) => {
          console.error("[AIOS Background] Failed to send to tab:", err);
        });
        break;
      case "ERROR":
        console.error("\u274C [AIOS Background] Critical Runtime Error Message:", JSON.stringify(message.payload, null, 2));
        break;
      case "TOOL_RESULT":
        console.log("\u2705 [AIOS Background] Tool Execution Successful! Result:", JSON.stringify(message.payload, null, 2));
        break;
      default:
        console.warn("[AIOS Background] Unknown message type from Runtime:", message.type);
    }
  }
  function sendToRuntime(message) {
    if (!isConnected || !wsConnection) {
      console.warn("[AIOS Background] Not connected to Runtime, queuing message");
      pendingMessages.push(message);
      return false;
    }
    try {
      wsConnection.send(JSON.stringify(message));
      return true;
    } catch (e) {
      console.error("[AIOS Background] Failed to send to Runtime:", e);
      return false;
    }
  }
  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[AIOS Background] Received from popup/content:", message);
    switch (message.type) {
      case "TOOL_REQUEST":
        console.log("[AIOS Background] Forwarding tool request to runtime:", message.payload);
        const toolMsg = {
          type: "TOOL_REQUEST",
          id: generateId(),
          taskId: message.taskId || null,
          payload: {
            tool: message.payload.tool,
            params: message.payload.params,
            taskId: message.taskId || null,
            authToken: self.activeAuthToken
            // 👈 Injects the dynamic token from the handshake
          },
          ts: (/* @__PURE__ */ new Date()).toISOString()
        };
        sendToRuntime(toolMsg);
        sendResponse({ success: true, status: "Forwarded to Runtime" });
        break;
      case "GET_STATUS":
        sendResponse({
          isConnected,
          runtimeUrl: RUNTIME_WS_URL
        });
        break;
      case "CONNECT_TAB":
        const connectMsg = {
          type: "CONNECT_TAB",
          id: generateId(),
          taskId: null,
          payload: {
            workspaceId: message.workspaceId || "default-workspace",
            tabId: message.tabId,
            providerId: message.providerId,
            agentMode: message.agentMode || "manual"
            // Add default agentMode
          },
          ts: (/* @__PURE__ */ new Date()).toISOString()
        };
        sendToRuntime(connectMsg);
        sendResponse({ success: true });
        break;
      case "DISCONNECT_TAB":
        const disconnectMsg = {
          type: "DISCONNECT_TAB",
          id: generateId(),
          taskId: null,
          payload: {
            tabId: message.tabId
          },
          ts: (/* @__PURE__ */ new Date()).toISOString()
        };
        sendToRuntime(disconnectMsg);
        sendResponse({ success: true });
        break;
      case "ADAPTER_RESULT":
        const adapterMsg = {
          type: "ADAPTER_RESULT",
          id: generateId(),
          taskId: message.taskId,
          payload: {
            tabId: message.tabId,
            result: message.result
          },
          ts: (/* @__PURE__ */ new Date()).toISOString()
        };
        sendToRuntime(adapterMsg);
        sendResponse({ success: true });
        break;
      case "USER_ACTION":
        console.log("[AIOS Background] User action intercepted:", message.payload);
        const userActionMsg = {
          type: "USER_ACTION",
          id: generateId(),
          taskId: null,
          payload: {
            tabId: message.tabId || message.payload.tabId,
            action: message.payload.action,
            data: message.payload
          },
          ts: (/* @__PURE__ */ new Date()).toISOString()
        };
        sendToRuntime(userActionMsg);
        sendResponse({ success: true });
        break;
      case "SET_AGENT_MODE":
        const modeMsg = {
          type: "SET_AGENT_MODE",
          id: generateId(),
          taskId: null,
          payload: {
            tabId: message.tabId,
            mode: message.mode
          },
          ts: (/* @__PURE__ */ new Date()).toISOString()
        };
        sendToRuntime(modeMsg);
        sendResponse({ success: true });
        break;
      default:
        console.warn("[AIOS Background] Unknown message type:", message.type);
        sendResponse({ error: "Unknown message type" });
    }
    return true;
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.tab && message.type === "ADAPTER_RESULT") {
      const adapterMsg = {
        type: "ADAPTER_RESULT",
        id: generateId(),
        taskId: message.taskId,
        payload: {
          tabId: sender.tab.id,
          result: message.result
        },
        ts: (/* @__PURE__ */ new Date()).toISOString()
      };
      sendToRuntime(adapterMsg);
      sendResponse({ success: true });
      return true;
    }
  });
  connectToRuntime().catch((err) => {
    console.error("[AIOS Background] Initial connection failed:", err);
  });
  console.log("[AIOS Background] Service worker initialized");
})();
