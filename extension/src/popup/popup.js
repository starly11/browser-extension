// src/popup/popup.js
// Popup UI logic - displays Runtime status, connected tabs, and allows connect/disconnect

let currentTabId = null;
let isConnectedToRuntime = false;
let isTabConnected = false;
let currentProviderId = null;
let currentWorkspaceId = 'default-workspace'; // Default workspace ID

// DOM elements
const statusEl = document.getElementById('status');
const tabInfoEl = document.getElementById('tabInfo');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const agentModeSelect = document.getElementById('agentMode');
const setModeBtn = document.getElementById('setModeBtn');
const modeIndicatorEl = document.getElementById('modeIndicator');

// Initialize popup
async function init() {
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTabId = tab.id;
    currentProviderId = detectProvider(tab.url);
    updateTabInfo(tab);
  }
  
  // Check Runtime connection status
  checkRuntimeStatus();
  
  // Update button states
  updateButtonStates();
}

// Detect provider from URL
function detectProvider(url) {
  if (!url) return 'unknown';
  
  // Updated to support both the modern chatgpt.com domain and legacy domain
  if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
    return 'chatgpt';
  } else if (url.includes('claude.ai') || url.includes('anthropic.com')) {
    return 'claude';
  } else if (url.includes('gemini.google.com')) {
    return 'gemini';
  }
  
  return 'unknown';
}

// Update tab info display
function updateTabInfo(tab) {
  const providerName = currentProviderId === 'chatgpt' ? 'ChatGPT' :
                       currentProviderId === 'claude' ? 'Claude' :
                       currentProviderId === 'gemini' ? 'Gemini' : 'Unknown';
  
  tabInfoEl.innerHTML = `
    <strong>Title:</strong> ${tab.title}<br>
    <strong>Provider:</strong> ${providerName}<br>
    <strong>ID:</strong> ${tab.id}
  `;
}

// Check Runtime connection status
function checkRuntimeStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (chrome.runtime.lastError) {
      updateStatus(false, 'Background script error');
      return;
    }
    
    if (response && response.isConnected) {
      updateStatus(true, 'Runtime Connected');
      isConnectedToRuntime = true;
    } else {
      updateStatus(false, 'Runtime Disconnected');
      isConnectedToRuntime = false;
    }
    
    updateButtonStates();
  });
}

// Update status display
function updateStatus(connected, message) {
  statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`;
  statusEl.textContent = message;
}

// Update button states based on connection status
function updateButtonStates() {
  const canConnect = isConnectedToRuntime && !isTabConnected && currentProviderId !== 'unknown';
  const canDisconnect = isConnectedToRuntime && isTabConnected;
  const canSetMode = isConnectedToRuntime && isTabConnected;
  
  connectBtn.disabled = !canConnect;
  disconnectBtn.disabled = !canDisconnect;
  setModeBtn.disabled = !canSetMode;
  
  if (!isConnectedToRuntime) {
    connectBtn.title = 'Runtime must be running';
    disconnectBtn.title = 'Runtime must be running';
    setModeBtn.title = 'Runtime must be running';
  } else if (currentProviderId === 'unknown') {
    connectBtn.title = 'Unsupported provider';
  } else {
    connectBtn.title = '';
    disconnectBtn.title = '';
    setModeBtn.title = '';
  }
}

// Connect current tab to Runtime
async function connectTab() {
  if (!currentTabId || !currentProviderId) {
    alert('Cannot connect: unsupported provider or invalid tab');
    return;
  }
  
  try {
    await chrome.runtime.sendMessage({
      type: 'CONNECT_TAB',
      tabId: currentTabId,
      providerId: currentProviderId,
      workspaceId: currentWorkspaceId
    });
    
    isTabConnected = true;
    updateButtonStates();
    updateTabConnectionStatus(true);
  } catch (error) {
    console.error('Failed to connect tab:', error);
    alert('Failed to connect tab');
  }
}

// Disconnect current tab from Runtime
async function disconnectTab() {
  if (!currentTabId) {
    alert('No tab to disconnect');
    return;
  }
  
  try {
    await chrome.runtime.sendMessage({
      type: 'DISCONNECT_TAB',
      tabId: currentTabId
    });
    
    isTabConnected = false;
    updateButtonStates();
    updateTabConnectionStatus(false);
  } catch (error) {
    console.error('Failed to disconnect tab:', error);
    alert('Failed to disconnect tab');
  }
}

// Set agent mode for current tab
async function setAgentMode() {
  if (!currentTabId) {
    alert('No tab selected');
    return;
  }
  
  const mode = agentModeSelect.value;
  
  try {
    await chrome.runtime.sendMessage({
      type: 'SET_AGENT_MODE',
      tabId: currentTabId,
      mode: mode
    });
    
    modeIndicatorEl.textContent = `Mode set to: ${mode}`;
    setTimeout(() => {
      modeIndicatorEl.textContent = '';
    }, 3000);
  } catch (error) {
    console.error('Failed to set agent mode:', error);
    alert('Failed to set agent mode');
  }
}

// Update tab connection status display
function updateTabConnectionStatus(connected) {
  if (connected) {
    tabInfoEl.innerHTML += '<br><strong style="color: green;">✓ Connected</strong>';
  } else {
    // Refresh tab info
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab) {
        updateTabInfo(tab);
      }
    });
  }
}

// Event listeners
connectBtn.addEventListener('click', connectTab);
disconnectBtn.addEventListener('click', disconnectTab);
setModeBtn.addEventListener('click', setAgentMode);

// Initialize on load
init();
