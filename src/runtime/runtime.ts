import { randomUUID } from 'crypto';
import path from 'path';
import { EventEmitter } from 'events';
import type {
  RuntimeState,
  Task,
  Workspace,
  ReasoningSession,
  ConnectedTab,
  CreateTaskRequest,
  ConnectTabRequest,
  RuntimeMessage,
  PermissionState,
} from '../shared/types.js';
import { SQLiteStorage } from './storage/sqlite.js';
import { WebSocketTransport } from './transport/websocket.js';

const DEFAULT_PERMISSIONS = {
  filesystem: 'ask' as const,
  terminal: 'ask' as const,
  git: 'ask' as const,
  writeFiles: 'ask' as const,
  browserAutomation: 'ask' as const,
  network: 'ask' as const,
};

export class Runtime extends EventEmitter {
  private storage: SQLiteStorage;
  private transport: WebSocketTransport;
  private state: RuntimeState;
  private isRunning: boolean = false;

  constructor(dbPath: string, wsPort: number = 9876) {
    super();
    this.storage = new SQLiteStorage(dbPath);
    this.transport = new WebSocketTransport(wsPort);
    this.state = {
      workspaces: new Map(),
      tasks: new Map(),
      sessions: new Map(),
      activeWorkspaceId: null,
    };

    this.setupTransportHandlers();
    this.loadState();
  }

  private setupTransportHandlers(): void {
    this.transport.on('message', (clientId: string, message: RuntimeMessage) => {
      this.handleClientMessage(clientId, message);
    });
  }

  private async loadState(): Promise<void> {
    try {
      // Load workspaces
      const workspaces = await this.storage.listWorkspaces();
      for (const ws of workspaces) {
        this.state.workspaces.set(ws.id, ws);
      }

      // Load tasks
      const tasks = await this.storage.listTasks();
      for (const task of tasks) {
        this.state.tasks.set(task.id, task);
      }

      // Load sessions
      const sessions = await this.storage.listSessions();
      for (const session of sessions) {
        this.state.sessions.set(session.id, session);
      }

      // Set active workspace (first one, or null)
      if (workspaces.length > 0) {
        this.state.activeWorkspaceId = workspaces[0].id;
        await this.storage.updateWorkspaceLastActive(workspaces[0].id);
      }

      console.log(`Loaded state: ${this.state.workspaces.size} workspaces, ${this.state.tasks.size} tasks`);
    } catch (err) {
      console.error('Failed to load state:', err);
    }
  }

  private async handleClientMessage(clientId: string, message: RuntimeMessage): Promise<void> {
    try {
      let response: any;

      switch (message.type) {
        case 'create_task':
          response = await this.createTask(message.payload);
          break;
        case 'get_task_status':
          response = await this.getTaskStatus(message.payload);
          break;
        case 'cancel_task':
          response = await this.cancelTask(message.payload);
          break;
        case 'connect_tab':
          response = await this.connectTab(message.payload);
          break;
        case 'disconnect_tab':
          response = await this.disconnectTab(message.payload);
          break;
        case 'set_agent_mode':
          response = await this.setAgentMode(message.payload);
          break;
        case 'get_workspace':
          response = await this.getWorkspace(message.payload);
          break;
        case 'switch_workspace':
          response = await this.switchWorkspace(message.payload);
          break;
        case 'get_permissions':
          response = await this.getPermissions(message.payload);
          break;
        case 'set_permission':
          response = await this.setPermission(message.payload);
          break;
        default:
          this.transport.sendError(clientId, `Unknown message type: ${message.type}`, message.requestId);
          return;
      }

      this.transport.send(clientId, {
        type: 'response',
        payload: response,
        requestId: message.requestId,
      } as RuntimeMessage);
    } catch (err: any) {
      console.error('Error handling message:', err);
      this.transport.sendError(clientId, err.message || 'Internal error', message.requestId);
    }
  }

  // ==================== Task Operations ====================

  private async createTask(request: CreateTaskRequest): Promise<{ taskId: string }> {
    const taskId = randomUUID();
    const now = new Date().toISOString();

    const task: Task = {
      id: taskId,
      prompt: request.prompt,
      status: 'created',
      steps: [],
      createdAt: now,
      updatedAt: now,
      workspaceId: request.workspaceId,
    };

    await this.storage.saveTask(task);
    this.state.tasks.set(taskId, task);

    this.emit('task_created', task);

    // In Phase 1, just return the task ID - planning will be added later
    return { taskId };
  }

  private async getTaskStatus(request: { taskId: string }): Promise<Task | null> {
    return this.storage.getTask(request.taskId);
  }

  private async cancelTask(request: { taskId: string }): Promise<{ success: boolean }> {
    const task = await this.storage.getTask(request.taskId);
    if (!task) {
      throw new Error(`Task ${request.taskId} not found`);
    }

    if (task.status === 'complete' || task.status === 'cancelled') {
      return { success: false };
    }

    await this.storage.updateTaskStatus(request.taskId, 'cancelled');
    const updated = await this.storage.getTask(request.taskId);
    if (updated) {
      this.state.tasks.set(request.taskId, updated);
    }

    return { success: true };
  }

  // ==================== Workspace Operations ====================

  private async connectTab(request: ConnectTabRequest): Promise<{ success: boolean }> {
    const workspaceId = this.state.activeWorkspaceId;
    if (!workspaceId) {
      throw new Error('No active workspace');
    }

    const workspace = await this.storage.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Active workspace not found');
    }

    // Check if tab already connected
    if (workspace.connectedTabs.some(t => t.tabId === request.tabId)) {
      return { success: false };
    }

    workspace.connectedTabs.push({
      tabId: request.tabId,
      providerId: request.providerId,
      agentMode: 'off',
    });

    await this.storage.saveWorkspace(workspace);
    this.state.workspaces.set(workspaceId, workspace);

    this.emit('tab_connected', { workspaceId, tabId: request.tabId, providerId: request.providerId });

    return { success: true };
  }

  private async disconnectTab(request: { tabId: number }): Promise<{ success: boolean }> {
    const workspaceId = this.state.activeWorkspaceId;
    if (!workspaceId) {
      throw new Error('No active workspace');
    }

    const workspace = await this.storage.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Active workspace not found');
    }

    const index = workspace.connectedTabs.findIndex(t => t.tabId === request.tabId);
    if (index === -1) {
      return { success: false };
    }

    workspace.connectedTabs.splice(index, 1);
    await this.storage.saveWorkspace(workspace);
    this.state.workspaces.set(workspaceId, workspace);

    // Also remove any sessions for this tab
    const sessions = await this.storage.listSessions();
    for (const session of sessions) {
      if (session.tabId === request.tabId) {
        await this.storage.deleteSession(session.id);
        this.state.sessions.delete(session.id);
      }
    }

    this.emit('tab_disconnected', { workspaceId, tabId: request.tabId });

    return { success: true };
  }

  private async setAgentMode(request: { tabId: number; mode: ConnectedTab['agentMode'] }): Promise<{ success: boolean }> {
    const workspaceId = this.state.activeWorkspaceId;
    if (!workspaceId) {
      throw new Error('No active workspace');
    }

    const workspace = await this.storage.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Active workspace not found');
    }

    const tab = workspace.connectedTabs.find(t => t.tabId === request.tabId);
    if (!tab) {
      return { success: false };
    }

    tab.agentMode = request.mode;
    await this.storage.saveWorkspace(workspace);
    this.state.workspaces.set(workspaceId, workspace);

    this.emit('agent_mode_changed', { workspaceId, tabId: request.tabId, mode: request.mode });

    return { success: true };
  }

  private async getWorkspace(request?: { workspaceId?: string }): Promise<Workspace | null> {
    const workspaceId = request?.workspaceId || this.state.activeWorkspaceId;
    if (!workspaceId) {
      return null;
    }
    return this.storage.getWorkspace(workspaceId);
  }

  private async switchWorkspace(request: { workspaceId: string }): Promise<{ success: boolean }> {
    const workspace = await this.storage.getWorkspace(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${request.workspaceId} not found`);
    }

    this.state.activeWorkspaceId = request.workspaceId;
    await this.storage.updateWorkspaceLastActive(request.workspaceId);

    this.emit('workspace_switched', { workspaceId: request.workspaceId });

    return { success: true };
  }

  private async getPermissions(request?: { workspaceId?: string }): Promise<any> {
    const workspaceId = request?.workspaceId || this.state.activeWorkspaceId;
    if (!workspaceId) {
      return null;
    }

    const workspace = await this.storage.getWorkspace(workspaceId);
    if (!workspace) {
      return null;
    }

    return workspace.permissions;
  }

  private async setPermission(request: {
    workspaceId?: string;
    tool: keyof Workspace['permissions'];
    state: PermissionState;
  }): Promise<{ success: boolean }> {
    const workspaceId = request.workspaceId || this.state.activeWorkspaceId;
    if (!workspaceId) {
      throw new Error('No workspace specified');
    }

    const workspace = await this.storage.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    workspace.permissions[request.tool] = request.state;
    await this.storage.saveWorkspace(workspace);
    this.state.workspaces.set(workspaceId, workspace);

    return { success: true };
  }

  // ==================== Lifecycle ====================

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('AIOS Runtime started');
    console.log(`  Storage: SQLite database loaded`);
    console.log(`  WebSocket: ws://localhost:${(this.transport as any).port}`);
    console.log(`  Active workspace: ${this.state.activeWorkspaceId || 'none'}`);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.transport.close();
    this.storage.close();
    console.log('AIOS Runtime stopped');
  }
}
