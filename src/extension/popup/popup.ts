/// <reference types="chrome" />

// ==================== State ====================

interface PopupState {
  runtimeConnected: boolean;
  activeWorkspaceId: string | null;
  workspaceName: string;
  connectedTabs: Array<{ tabId: number; providerId: string; agentMode: string }>;
  currentTask: string | null;
}

let state: PopupState = {
  runtimeConnected: false,
  activeWorkspaceId: null,
  workspaceName: 'None selected',
  connectedTabs: [],
  currentTask: null,
};

// ==================== DOM References ====================

const $ = (selector: string) => document.querySelector(selector);
const $$ = (selector: string) => document.querySelectorAll(selector);

const statusBadge = $('#status-badge')!;
const workspaceName = $('#workspace-name')!;
const selectWorkspaceBtn = $('#select-workspace')!;
const tabList = $('#tab-list')!;
const taskStatus = $('#task-status')!;
const runtimeStatusText = $('#runtime-status-text')!;
const refreshBtn = $('#refresh-btn')!;

// ==================== Rendering ====================

function render(): void {
  // Status badge
  statusBadge.textContent = state.runtimeConnected ? '● Connected' : '● Disconnected';
  statusBadge.className = `status-${state.runtimeConnected ? 'connected' : 'disconnected'}`;

  // Workspace
  workspaceName.textContent = state.workspaceName;

  // Runtime status
  runtimeStatusText.textContent = state.runtimeConnected ? 'Connected' : 'Disconnected';
  runtimeStatusText.style.color = state.runtimeConnected ? '#4caf50' : '#f44336';

  // Task
  taskStatus.textContent = state.currentTask || 'No active task';

  // Tab list
  renderTabs();
}

function renderTabs(): void {
  if (state.connectedTabs.length === 0) {
    tabList.innerHTML = '<li class="empty-state">No tabs connected</li>';
    return;
  }

  tabList.innerHTML = state.connectedTabs.map(tab => `
    <li class="tab-item">
      <span class="tab-provider">${tab.providerId}</span>
      <span class="tab-mode ${tab.agentMode}">${tab.agentMode}</span>
      <button class="disconnect-tab" data-tab-id="${tab.tabId}">✕</button>
    </li>
  `).join('');

  // Add event listeners to disconnect buttons
  tabList.querySelectorAll('.disconnect-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = parseInt((e.target as HTMLElement).dataset.tabId!);
      disconnectTab(tabId);
    });
  });
}

// ==================== Actions ====================

function requestState(): void {
  // Query the background for current state
  chrome.runtime.sendMessage({ type: 'get_state' }, (response) => {
    if (response) {
      state = { ...state, ...response };
      render();
    }
  });
}

function selectWorkspace(): void {
  // In a real implementation, this would open a file picker
  // For Phase 1, we'll simulate it
  const workspacePath = prompt('Enter project path:', '/path/to/your/project');
  if (workspacePath) {
    chrome.runtime.sendMessage({
      type: 'create_workspace',
      payload: { name: workspacePath.split('/').pop(), projectPath: workspacePath },
    }, (response) => {
      if (response?.workspaceId) {
        state.workspaceName = workspacePath.split('/').pop() || workspacePath;
        state.activeWorkspaceId = response.workspaceId;
        render();
      }
    });
  }
}

function disconnectTab(tabId: number): void {
  chrome.runtime.sendMessage({
    type: 'disconnect_tab',
    payload: { tabId },
  }, () => {
    state.connectedTabs = state.connectedTabs.filter(t => t.tabId !== tabId);
    render();
  });
}

// ==================== Popup Lifecycle ====================

document.addEventListener('DOMContentLoaded', () => {
  requestState();

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'state_update') {
      state = { ...state, ...message.payload };
      render();
    }
  });

  // Event listeners
  selectWorkspaceBtn.addEventListener('click', selectWorkspace);
  refreshBtn.addEventListener('click', requestState);

  // Connect current tab button (in header)
  // We could add this as a dedicated button
});

// ==================== Connect Current Tab ====================

// Also listen for keyboard shortcut or explicit connect action
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (tab && tab.id) {
    // Add a quick connect button if we're on a supported page
    const url = tab.url || '';
    if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
      // Show a connection prompt
      const connectBtn = document.createElement('button');
      connectBtn.textContent = 'Connect This Tab';
      connectBtn.className = 'connect-tab-btn';
      connectBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          type: 'connect_tab',
          payload: { tabId: tab.id, providerId: 'chatgpt' },
        }, () => {
          requestState();
        });
      });
      document.querySelector('#tabs-section')?.prepend(connectBtn);
    }
  }
});
