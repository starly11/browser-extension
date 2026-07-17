// Popup script — shows connection status and provides manual reconnect

const dot = document.getElementById('dot');
const statusText = document.getElementById('status-text');
const reconnectBtn = document.getElementById('reconnect-btn');

function updateStatus(connected) {
  dot.className = 'dot ' + (connected ? 'connected' : 'disconnected');
  statusText.textContent = connected ? 'Connected' : 'Disconnected';
}

// Query background for current status
chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
  updateStatus(response?.connected || false);
});

// Listen for status updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'runtime_status') {
    updateStatus(msg.status === 'connected');
  }
});

// Manual reconnect
reconnectBtn.addEventListener('click', () => {
  dot.className = 'dot connecting';
  statusText.textContent = 'Connecting...';
  chrome.runtime.sendMessage({ type: 'get_status' }, () => {
    // Background will auto-reconnect; just poll status
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'get_status' }, (r) => updateStatus(r?.connected));
    }, 1500);
  });
});
