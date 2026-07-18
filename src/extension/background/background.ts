/// <reference types="chrome" />

import type { RuntimeMessage, ConnectTabRequest } from '../../shared/types.js';

// ==================== Constants ====================

const RUNTIME_WS_URL = 'ws://localhost:9876';
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// ==================== WebSocket Connection ====================

function connectToRuntime(): void {
  try {
    ws = new WebSocket(RUNTIME_WS_URL);

    ws.onopen = () => {
      console.log('[AIOS] Connected to Runtime');
      reconnectAttempts = 0;
      updateExtensionIcon('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as RuntimeMessage;
        handleRuntimeMessage(message);
      } catch (err) {
        console.error('[AIOS] Failed to parse Runtime message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[AIOS] Disconnected from Runtime');
      updateExtensionIcon('disconnected');
      attemptReconnect();
    };

    ws.onerror = (err) => {
      console.error('[AIOS] WebSocket error:', err);
    };
  } catch (err) {
    console.error('[AIOS] Failed to connect to Runtime:', err);
    attemptReconnect();
  }
}

function attemptReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('[AIOS] Max reconnect attempts reached');
    updateExtensionIcon('error');
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
  console.log(`[AIOS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

  setTimeout(() => connectToRuntime(), delay);
}

function sendToRuntime(message: RuntimeMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    console.error('[AIOS] Cannot send to Runtime - not connected');
  }
}

// ==================== Message Handling ====================

function handleRuntimeMessage(message: RuntimeMessage): void {
  switch (message.type) {
    case 'response':
    case 'error':
      // Forward responses to the popup or content script
      chrome.runtime.sendMessage(message);
      break;

    case 'relay_to_adapter':
      // Forward to the content script in the appropriate tab
      forwardToAdapter(message.payload);
      break;

    default:
      console.log('[AIOS] Received unhandled message type:', message.type);
  }
}

function forwardToAdapter(payload: { tabId: number; instruction: any }): void {
  chrome.tabs.sendMessage(payload.tabId, {
    type: 'adapter_instruction',
    instruction: payload.instruction,
  }).catch(err => {
    console.error('[AIOS] Failed to forward to adapter:', err);
    // Report tab disconnect back to Runtime
    sendToRuntime({
      type: 'disconnect_tab',
      payload: { tabId: payload.tabId },
    });
  });
}

// ==================== Tab Management ====================

chrome.tabs.onRemoved.addListener((tabId) => {
  // Report tab closure to Runtime
  sendToRuntime({
    type: 'disconnect_tab',
    payload: { tabId },
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if we should auto-detect AI provider
    detectProvider(tabId, tab.url);
  }
});

function detectProvider(tabId: number, url: string): void {
  if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
    // This is a ChatGPT tab - notify the popup
    chrome.runtime.sendMessage({
      type: 'provider_detected',
      payload: { tabId, providerId: 'chatgpt' },
    });
  }
}

// ==================== Extension Icon ====================

function updateExtensionIcon(state: 'connected' | 'disconnected' | 'error'): void {
  const colors = {
    connected: [0, 255, 0, 255],
    disconnected: [128, 128, 128, 255],
    error: [255, 0, 0, 255],
  };

  const color = colors[state];
  const path = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
      <circle cx="8" cy="8" r="6" fill="rgb(${color[0]},${color[1]},${color[2]})" stroke="white" stroke-width="1"/>
    </svg>
  `)}`;

  chrome.action.setIcon({ path });
}

// ==================== Message Listeners ====================

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  // Forward to Runtime
  sendToRuntime(message);
  sendResponse({ success: true });
});

// ==================== Initialization ====================

console.log('[AIOS] Background service worker started');

// Connect to Runtime on startup
connectToRuntime();

// Keep service worker alive
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Send a ping to keep the connection alive
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);
