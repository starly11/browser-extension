// src/background/index.js
// Background service worker - acts as a relay between popup/content scripts and the Runtime

const RUNTIME_WS_URL = 'ws://127.0.0.1:8765';
const AUTH_TOKEN = 'aios-local-token'; // TODO: load from secure storage

let wsConnection = null;
let isConnected = false;
let messageHandlers = new Map();
let pendingMessages = [];

// Connect to Runtime WebSocket server
async function connectToRuntime() {
  if (wsConnection) {
    wsConnection.close();
  }

  return new Promise((resolve, reject) => {
    try {
      wsConnection = new WebSocket(RUNTIME_WS_URL);

      wsConnection.onopen = () => {
        console.log('[AIOS Background] Connected to Runtime');
        isConnected = true;

        // Send AUTH_REQUEST with workspaceId (Runtime expects this)
        const authMessage = {
          type: 'AUTH_REQUEST',
          id: generateId(),
          taskId: null,
          payload: { 
            workspaceId: 'default-workspace'  // Runtime expects workspaceId, not token
          },
          ts: new Date().toISOString()
        };
        wsConnection.send(JSON.stringify(authMessage));
        resolve();
      };

      wsConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessageFromRuntime(message);
        } catch (e) {
          console.error('[AIOS Background] Failed to parse Runtime message:', e);
        }
      };

      wsConnection.onerror = (error) => {
        console.error('[AIOS Background] WebSocket error:', error);
        isConnected = false;
        reject(error);
      };

      wsConnection.onclose = () => {
        console.log('[AIOS Background] Disconnected from Runtime');
        isConnected = false;
        wsConnection = null;

        // Attempt reconnection after delay
        setTimeout(connectToRuntime, 5000);
      };
    } catch (e) {
      console.error('[AIOS Background] Failed to create WebSocket:', e);
      reject(e);
    }
  });
}

// Handle messages received from Runtime
function handleMessageFromRuntime(message) {
  console.log('[AIOS Background] Received from Runtime:', JSON.stringify(message, null, 2));

  // Route message based on type
  switch (message.type) {

    case 'AUTH_RESPONSE':
      console.log('[AIOS Background] Received auth token from Runtime:', message.payload.token);
      // Save the token globally to the worker instance so we can reuse it for subsequent requests
      self.activeAuthToken = message.payload.token;
      break;


    case 'RELAY_TO_ADAPTER':
      // Forward message to content script in specific tab
      const { tabId, instruction } = message.payload;
      chrome.tabs.sendMessage(tabId, {
        type: 'RELAY_TO_ADAPTER',
        instruction: instruction
      }).catch(err => {
        console.error('[AIOS Background] Failed to send to tab:', err);
      });
      break;

    case 'TOOL_REQUEST':
      // Forward tool request to content script for adapter execution
      const toolTabId = message.payload?.tabId || message.payload?.connectedTabId;
      if (toolTabId) {
        chrome.tabs.sendMessage(toolTabId, {
          type: 'TOOL_REQUEST',
          taskId: message.taskId,
          payload: message.payload
        }).catch(err => {
          console.error('[AIOS Background] Failed to send TOOL_REQUEST to tab:', err);
        });
      } else {
        console.warn('[AIOS Background] TOOL_REQUEST received without tabId');
      }
      break;

    case 'ERROR':
      console.error('❌ [AIOS Background] Critical Runtime Error Message:', JSON.stringify(message.payload, null, 2));
      break;

    case 'TOOL_RESULT':
      console.log('✅ [AIOS Background] Tool Execution Successful! Result:', JSON.stringify(message.payload, null, 2));
      // Here you can forward the tool result back to the web app/adapter if needed
      break;

    default:
      console.warn('[AIOS Background] Unknown message type from Runtime:', message.type);
  }
}

// Send message to Runtime
function sendToRuntime(message) {
  if (!isConnected || !wsConnection) {
    console.warn('[AIOS Background] Not connected to Runtime, queuing message');
    pendingMessages.push(message);
    return false;
  }

  try {
    wsConnection.send(JSON.stringify(message));
    return true;
  } catch (e) {
    console.error('[AIOS Background] Failed to send to Runtime:', e);
    return false;
  }
}

// Generate unique ID
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[AIOS Background] Received from popup/content:', message);

  switch (message.type) {

    case 'TOOL_REQUEST':
      console.log('[AIOS Background] Forwarding tool request to runtime:', message.payload);
      const toolMsg = {
        type: 'TOOL_REQUEST',
        id: generateId(),
        taskId: message.taskId || null,
        payload: {
          tool: message.payload.tool,
          params: message.payload.params,
          taskId: message.taskId || null,
          authToken: self.activeAuthToken // 👈 Injects the dynamic token from the handshake
        },
        ts: new Date().toISOString()
      };
      sendToRuntime(toolMsg);
      sendResponse({ success: true, status: 'Forwarded to Runtime' });
      break;

    case 'GET_STATUS':
      // Return current connection status
      sendResponse({
        isConnected: isConnected,
        runtimeUrl: RUNTIME_WS_URL
      });
      break;

    case 'CONNECT_TAB':
      // User clicked connect on current tab
      const connectMsg = {
        type: 'CONNECT_TAB',
        id: generateId(),
        taskId: null,
        payload: {
          workspaceId: message.workspaceId || 'default-workspace',
          tabId: message.tabId,
          providerId: message.providerId,
          agentMode: message.agentMode || 'manual'  // Add default agentMode
        },
        ts: new Date().toISOString()
      };
      sendToRuntime(connectMsg);
      sendResponse({ success: true });
      break;

    case 'DISCONNECT_TAB':
      // User clicked disconnect
      const disconnectMsg = {
        type: 'DISCONNECT_TAB',
        id: generateId(),
        taskId: null,
        payload: {
          tabId: message.tabId
        },
        ts: new Date().toISOString()
      };
      sendToRuntime(disconnectMsg);
      sendResponse({ success: true });
      break;

    case 'ADAPTER_RESULT':
      // Content script sending adapter result back to Runtime
      const adapterMsg = {
        type: 'ADAPTER_RESULT',
        id: generateId(),
        taskId: message.taskId,
        payload: {
          tabId: message.tabId,
          result: message.result
        },
        ts: new Date().toISOString()
      };
      sendToRuntime(adapterMsg);
      sendResponse({ success: true });
      break;

    case 'USER_ACTION':
      // User action intercepted from content script (e.g., sending a prompt)
      console.log('[AIOS Background] User action intercepted:', message.payload);
      // Forward to Runtime for processing/interception
      const userActionMsg = {
        type: 'USER_ACTION',
        id: generateId(),
        taskId: null,
        payload: {
          tabId: message.tabId || message.payload.tabId,
          action: message.payload.action,
          data: message.payload
        },
        ts: new Date().toISOString()
      };
      sendToRuntime(userActionMsg);
      sendResponse({ success: true });
      break;

    case 'SET_AGENT_MODE':
      const modeMsg = {
        type: 'SET_AGENT_MODE',
        id: generateId(),
        taskId: null,
        payload: {
          tabId: message.tabId,
          mode: message.mode
        },
        ts: new Date().toISOString()
      };
      sendToRuntime(modeMsg);
      sendResponse({ success: true });
      break;

    default:
      console.warn('[AIOS Background] Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep channel open for async response
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab && message.type === 'ADAPTER_RESULT') {
    // Forward adapter result to Runtime
    const adapterMsg = {
      type: 'ADAPTER_RESULT',
      id: generateId(),
      taskId: message.taskId,
      payload: {
        tabId: sender.tab.id,
        result: message.result
      },
      ts: new Date().toISOString()
    };
    sendToRuntime(adapterMsg);
    sendResponse({ success: true });
    return true;
  }
});

// Initialize connection on startup
connectToRuntime().catch(err => {
  console.error('[AIOS Background] Initial connection failed:', err);
});

console.log('[AIOS Background] Service worker initialized');