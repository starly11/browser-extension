AIOS Build Plan & Implementation
I understand you want me to help you build this system. Since I can't access your actual filesystem or Git, I'll provide you with a complete, structured implementation plan and all the code files you need to get started.

📋 Implementation Strategy
Based on the PROGRESS.md and all architecture docs, we'll build Phase 1: Skeleton first, which is the walking skeleton that verifies end-to-end connectivity before adding any AI logic.

PHASE 1: WALKING SKELETON
Step 1: Project Structure
text
AIOS/
├── docs/                    # All specification docs (you already have these)
├── src/
│   ├── shared/
│   │   ├── types.ts         # Shared TypeScript types
│   │   └── contracts.ts     # Contract validation
│   ├── runtime/
│   │   ├── index.ts         # Runtime entry point
│   │   ├── storage/
│   │   │   └── sqlite.ts    # SQLite storage layer
│   │   ├── transport/
│   │   │   └── websocket.ts # WebSocket server for extension comms
│   │   └── runtime.ts       # Main Runtime class
│   ├── extension/
│   │   ├── manifest.json    # Chrome extension manifest
│   │   ├── popup/
│   │   │   ├── popup.html
│   │   │   ├── popup.ts
│   │   │   └── popup.css
│   │   ├── background/
│   │   │   └── background.ts # Background service worker
│   │   └── content/
│   │       └── content.ts    # Content script for DOM injection
│   └── adapters/
│       ├── base/
│       │   └── adapter.ts    # Adapter interface
│       └── chatgpt/
│           └── adapter.ts    # ChatGPT implementation
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .gitignore
Step 2: Core Type Definitions
src/shared/types.ts
typescript
/**
 * AIOS Shared Types
 * From docs/02-Contracts/Contracts.md
 */

// ==================== Tasks ====================

export interface Task {
  id: string;
  prompt: string;
  status: TaskStatus;
  steps: TaskStep[];
  createdAt: string;
  workspaceId: string;
  updatedAt: string;
}

export type TaskStatus = 
  | 'created'
  | 'planning'
  | 'waiting_for_tool'
  | 'executing_tool'
  | 'working'
  | 'complete'
  | 'failed'
  | 'stalled'
  | 'cancelled'
  | 'delivery_failed';

export interface TaskStep {
  id: string;
  type: 'planning' | 'tool_request' | 'tool_result' | 'worker' | 'delivery';
  timestamp: string;
  data: any;
}

// ==================== Workspaces ====================

export interface Workspace {
  id: string;
  name: string;
  projectPath: string;
  connectedTabs: ConnectedTab[];
  permissions: WorkspacePermissions;
  createdAt: string;
  lastActiveAt: string;
}

export interface ConnectedTab {
  tabId: number;
  providerId: string;
  agentMode: AgentMode;
}

export type AgentMode = 'off' | 'manual' | 'assistant' | 'autonomous';

export interface WorkspacePermissions {
  filesystem: PermissionState;
  terminal: PermissionState;
  git: PermissionState;
  writeFiles: PermissionState;
  browserAutomation: PermissionState;
  network: PermissionState;
}

export type PermissionState = 'allowed' | 'ask' | 'denied';

// ==================== Reasoning Sessions ====================

export interface ReasoningSession {
  id: string;
  role: 'planner' | 'worker';
  tabId: number;
  providerId: string;
  status: 'idle' | 'busy' | 'degraded' | 'lost';
}

// ==================== Chat / Adapter ====================

export interface ChatHandle {
  tabId: number;
  chatId: string;
  providerId: string;
}

export interface Response {
  text: string;
  attachments: string[];
  status: 'complete' | 'uncertain' | 'error';
}

export interface AdapterManifest {
  providerId: string;
  version: string;
  supportedCapabilities: string[];
  unsupportedCapabilities: string[];
}

// ==================== Tools ====================

export interface ToolDefinition {
  name: string;
  paramsSchema: Record<string, any>;
  requiredPermission: keyof WorkspacePermissions;
  handler: (params: any, workspaceId: string) => Promise<ToolResult>;
}

export interface ToolRequest {
  tool: string;
  params: any;
  taskId: string;
}

export interface ToolResult {
  status: 'success' | 'error' | 'denied';
  data?: any;
  error?: string;
}

// ==================== Messages / Protocol ====================

export interface RuntimeMessage {
  type: RuntimeMessageType;
  payload: any;
  requestId?: string;
}

export type RuntimeMessageType = 
  | 'create_task'
  | 'get_task_status'
  | 'cancel_task'
  | 'connect_tab'
  | 'disconnect_tab'
  | 'set_agent_mode'
  | 'get_workspace'
  | 'switch_workspace'
  | 'get_permissions'
  | 'set_permission'
  | 'relay_to_adapter'
  | 'adapter_result';

export interface CreateTaskRequest {
  prompt: string;
  workspaceId: string;
  tabId: number;
}

export interface ConnectTabRequest {
  tabId: number;
  providerId: string;
}

// ==================== Adapter Interface ====================

export interface BrowserAdapter {
  detect(): Promise<{ supported: boolean; providerId: string; version: string }>;
  newChat(): Promise<ChatHandle>;
  sendPrompt(chatHandle: ChatHandle, text: string): Promise<void>;
  attachFiles(chatHandle: ChatHandle, files: string[]): Promise<void>;
  waitUntilFinished(chatHandle: ChatHandle): Promise<Response>;
  readResponse(chatHandle: ChatHandle): Promise<Response>;
  stopGeneration(chatHandle: ChatHandle): Promise<void>;
  rotate(chatHandle: ChatHandle): Promise<ChatHandle>;
  healthCheck(): Promise<{ ok: boolean; reason?: string }>;
  getManifest(): AdapterManifest;
}

// ==================== Storage ====================

export interface StorageAdapter {
  // Tasks
  saveTask(task: Task): Promise<void>;
  getTask(taskId: string): Promise<Task | null>;
  updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>;
  listTasks(workspaceId?: string): Promise<Task[]>;
  
  // Workspaces
  saveWorkspace(workspace: Workspace): Promise<void>;
  getWorkspace(workspaceId: string): Promise<Workspace | null>;
  listWorkspaces(): Promise<Workspace[]>;
  updateWorkspaceLastActive(workspaceId: string): Promise<void>;
  
  // Sessions
  saveSession(session: ReasoningSession): Promise<void>;
  getSession(sessionId: string): Promise<ReasoningSession | null>;
  updateSessionStatus(sessionId: string, status: ReasoningSession['status']): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<ReasoningSession[]>;
}

// ==================== Runtime State ====================

export interface RuntimeState {
  workspaces: Map<string, Workspace>;
  tasks: Map<string, Task>;
  sessions: Map<string, ReasoningSession>;
  activeWorkspaceId: string | null;
}
Step 3: SQLite Storage Layer
src/runtime/storage/sqlite.ts
typescript
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type {
  StorageAdapter,
  Task,
  Workspace,
  ReasoningSession,
  ConnectedTab,
  WorkspacePermissions,
  TaskStep,
  AgentMode,
  PermissionState,
} from '../../shared/types.js';

const DB_VERSION = 1;

export class SQLiteStorage implements StorageAdapter {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initializeSchema();
    this.validateSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      -- Version tracking
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Workspaces
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL
      );

      -- Workspace permissions (stored as JSON)
      CREATE TABLE IF NOT EXISTS workspace_permissions (
        workspace_id TEXT PRIMARY KEY,
        permissions_json TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      -- Connected tabs
      CREATE TABLE IF NOT EXISTS connected_tabs (
        tab_id INTEGER PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        agent_mode TEXT NOT NULL CHECK(agent_mode IN ('off', 'manual', 'assistant', 'autonomous')),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      -- Tasks
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN (
          'created', 'planning', 'waiting_for_tool', 'executing_tool',
          'working', 'complete', 'failed', 'stalled', 'cancelled', 'delivery_failed'
        )),
        workspace_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      -- Task steps (stored as JSON for flexibility)
      CREATE TABLE IF NOT EXISTS task_steps (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('planning', 'tool_request', 'tool_result', 'worker', 'delivery')),
        timestamp TEXT NOT NULL,
        data_json TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      -- Reasoning sessions
      CREATE TABLE IF NOT EXISTS reasoning_sessions (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK(role IN ('planner', 'worker')),
        tab_id INTEGER NOT NULL,
        provider_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('idle', 'busy', 'degraded', 'lost')),
        FOREIGN KEY (tab_id) REFERENCES connected_tabs(tab_id) ON DELETE CASCADE
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_task_steps_task ON task_steps(task_id);
      CREATE INDEX IF NOT EXISTS idx_connected_tabs_workspace ON connected_tabs(workspace_id);
    `);

    // Set version
    const version = this.db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version');
    if (!version) {
      this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('schema_version', String(DB_VERSION));
    }
  }

  private validateSchema(): void {
    const version = this.db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version');
    if (!version || parseInt((version as any).value) !== DB_VERSION) {
      throw new Error(`Schema version mismatch: expected ${DB_VERSION}, got ${version?.value || 'none'}`);
    }
  }

  // ==================== Task Methods ====================

  saveTask(task: Task): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tasks (id, prompt, status, workspace_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(task.id, task.prompt, task.status, task.workspaceId, task.createdAt, task.updatedAt);

    // Save steps
    const deleteStmt = this.db.prepare('DELETE FROM task_steps WHERE task_id = ?');
    deleteStmt.run(task.id);

    const insertStmt = this.db.prepare(`
      INSERT INTO task_steps (id, task_id, type, timestamp, data_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const step of task.steps) {
      insertStmt.run(step.id, task.id, step.type, step.timestamp, JSON.stringify(step.data));
    }

    return Promise.resolve();
  }

  getTask(taskId: string): Promise<Task | null> {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(taskId) as any;

    if (!row) return Promise.resolve(null);

    const stepsStmt = this.db.prepare('SELECT * FROM task_steps WHERE task_id = ? ORDER BY timestamp');
    const stepsRows = stepsStmt.all(taskId) as any[];

    return Promise.resolve({
      id: row.id,
      prompt: row.prompt,
      status: row.status,
      workspaceId: row.workspace_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      steps: stepsRows.map(s => ({
        id: s.id,
        type: s.type,
        timestamp: s.timestamp,
        data: JSON.parse(s.data_json),
      })),
    });
  }

  updateTaskStatus(taskId: string, status: Task['status']): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE tasks SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(status, taskId);
    return Promise.resolve();
  }

  listTasks(workspaceId?: string): Promise<Task[]> {
    let query = 'SELECT id FROM tasks';
    const params: any[] = [];
    if (workspaceId) {
      query += ' WHERE workspace_id = ?';
      params.push(workspaceId);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return Promise.all(rows.map(r => this.getTask(r.id))).then(tasks => 
      tasks.filter((t): t is Task => t !== null)
    );
  }

  // ==================== Workspace Methods ====================

  saveWorkspace(workspace: Workspace): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workspaces (id, name, project_path, created_at, last_active_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      workspace.id,
      workspace.name,
      workspace.projectPath,
      workspace.createdAt,
      workspace.lastActiveAt
    );

    // Save permissions
    const permStmt = this.db.prepare(`
      INSERT OR REPLACE INTO workspace_permissions (workspace_id, permissions_json)
      VALUES (?, ?)
    `);
    permStmt.run(workspace.id, JSON.stringify(workspace.permissions));

    // Save connected tabs
    const deleteTabs = this.db.prepare('DELETE FROM connected_tabs WHERE workspace_id = ?');
    deleteTabs.run(workspace.id);

    const tabStmt = this.db.prepare(`
      INSERT INTO connected_tabs (tab_id, workspace_id, provider_id, agent_mode)
      VALUES (?, ?, ?, ?)
    `);
    for (const tab of workspace.connectedTabs) {
      tabStmt.run(tab.tabId, workspace.id, tab.providerId, tab.agentMode);
    }

    return Promise.resolve();
  }

  getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const stmt = this.db.prepare('SELECT * FROM workspaces WHERE id = ?');
    const row = stmt.get(workspaceId) as any;

    if (!row) return Promise.resolve(null);

    const permStmt = this.db.prepare('SELECT permissions_json FROM workspace_permissions WHERE workspace_id = ?');
    const permRow = permStmt.get(workspaceId) as any;

    const tabsStmt = this.db.prepare('SELECT * FROM connected_tabs WHERE workspace_id = ?');
    const tabsRows = tabsStmt.all(workspaceId) as any[];

    return Promise.resolve({
      id: row.id,
      name: row.name,
      projectPath: row.project_path,
      createdAt: row.created_at,
      lastActiveAt: row.last_active_at,
      permissions: JSON.parse(permRow?.permissions_json || '{}'),
      connectedTabs: tabsRows.map(t => ({
        tabId: t.tab_id,
        providerId: t.provider_id,
        agentMode: t.agent_mode as AgentMode,
      })),
    });
  }

  listWorkspaces(): Promise<Workspace[]> {
    const stmt = this.db.prepare('SELECT id FROM workspaces');
    const rows = stmt.all() as any[];
    return Promise.all(rows.map(r => this.getWorkspace(r.id))).then(w => 
      w.filter((ws): ws is Workspace => ws !== null)
    );
  }

  updateWorkspaceLastActive(workspaceId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE workspaces SET last_active_at = datetime('now') WHERE id = ?
    `);
    stmt.run(workspaceId);
    return Promise.resolve();
  }

  // ==================== Session Methods ====================

  saveSession(session: ReasoningSession): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO reasoning_sessions (id, role, tab_id, provider_id, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(session.id, session.role, session.tabId, session.providerId, session.status);
    return Promise.resolve();
  }

  getSession(sessionId: string): Promise<ReasoningSession | null> {
    const stmt = this.db.prepare('SELECT * FROM reasoning_sessions WHERE id = ?');
    const row = stmt.get(sessionId) as any;

    if (!row) return Promise.resolve(null);

    return Promise.resolve({
      id: row.id,
      role: row.role,
      tabId: row.tab_id,
      providerId: row.provider_id,
      status: row.status,
    });
  }

  updateSessionStatus(sessionId: string, status: ReasoningSession['status']): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE reasoning_sessions SET status = ? WHERE id = ?
    `);
    stmt.run(status, sessionId);
    return Promise.resolve();
  }

  deleteSession(sessionId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM reasoning_sessions WHERE id = ?');
    stmt.run(sessionId);
    return Promise.resolve();
  }

  listSessions(): Promise<ReasoningSession[]> {
    const stmt = this.db.prepare('SELECT * FROM reasoning_sessions');
    const rows = stmt.all() as any[];
    return Promise.resolve(rows.map(r => ({
      id: r.id,
      role: r.role,
      tabId: r.tab_id,
      providerId: r.provider_id,
      status: r.status,
    })));
  }

  close(): void {
    this.db.close();
  }
}
Step 4: WebSocket Transport
src/runtime/transport/websocket.ts
typescript
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { RuntimeMessage } from '../../shared/types.js';

interface Client {
  ws: WebSocket;
  id: string;
  isAuthenticated: boolean;
}

export class WebSocketTransport extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, Client> = new Map();
  private port: number;

  constructor(port: number = 9876) {
    super();
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.setupServer();
  }

  private setupServer(): void {
    console.log(`WebSocket server listening on port ${this.port}`);

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = randomUUID();
      console.log(`Client connected: ${clientId}`);

      const client: Client = {
        ws,
        id: clientId,
        isAuthenticated: false,
      };

      this.clients.set(clientId, client);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as RuntimeMessage;
          this.handleMessage(clientId, message);
        } catch (err) {
          console.error('Failed to parse message:', err);
          this.sendError(clientId, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        this.emit('client_disconnected', clientId);
      });

      ws.on('error', (err) => {
        console.error(`Client error (${clientId}):`, err);
        // Don't delete client here - let 'close' handle cleanup
      });

      // Send connection confirmation
      this.send(clientId, {
        type: 'connected',
        payload: { clientId },
      } as RuntimeMessage);
    });

    this.wss.on('error', (err) => {
      console.error('WebSocket server error:', err);
      this.emit('error', err);
    });
  }

  private handleMessage(clientId: string, message: RuntimeMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      console.error(`Client not found: ${clientId}`);
      return;
    }

    // For now, allow all messages without authentication (will add token auth later)
    // Simple request/response correlation using requestId
    this.emit('message', clientId, message);
  }

  send(clientId: string, message: RuntimeMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      console.error(`Cannot send to unknown client: ${clientId}`);
      return;
    }

    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    } else {
      console.error(`WebSocket not open for client: ${clientId}`);
    }
  }

  sendError(clientId: string, error: string, requestId?: string): void {
    this.send(clientId, {
      type: 'error',
      payload: { error },
      requestId,
    } as RuntimeMessage);
  }

  broadcast(message: RuntimeMessage): void {
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    this.wss.close();
    this.clients.clear();
  }
}
Step 5: Runtime Core
src/runtime/runtime.ts
typescript
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
Step 6: Runtime Entry Point
src/runtime/index.ts
typescript
#!/usr/bin/env node

import { Runtime } from './runtime.js';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function main() {
  // Get configuration from environment or defaults
  const dbPath = process.env.AIOS_DB_PATH || resolve(process.cwd(), 'data/aios.db');
  const wsPort = parseInt(process.env.AIOS_WS_PORT || '9876');

  // Ensure data directory exists
  const dataDir = resolve(dbPath, '..');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const runtime = new Runtime(dbPath, wsPort);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await runtime.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    await runtime.stop();
    process.exit(0);
  });

  // Start the runtime
  await runtime.start();

  // Keep process alive
  console.log('Press Ctrl+C to stop');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
Step 7: Adapter Interface & ChatGPT Implementation
src/adapters/base/adapter.ts
typescript
import type { BrowserAdapter, ChatHandle, Response, AdapterManifest } from '../../shared/types.js';

export abstract class BaseAdapter implements BrowserAdapter {
  protected providerId: string;
  protected version: string;

  constructor(providerId: string, version: string) {
    this.providerId = providerId;
    this.version = version;
  }

  abstract detect(): Promise<{ supported: boolean; providerId: string; version: string }>;
  abstract newChat(): Promise<ChatHandle>;
  abstract sendPrompt(chatHandle: ChatHandle, text: string): Promise<void>;
  abstract attachFiles(chatHandle: ChatHandle, files: string[]): Promise<void>;
  abstract waitUntilFinished(chatHandle: ChatHandle): Promise<Response>;
  abstract readResponse(chatHandle: ChatHandle): Promise<Response>;
  abstract stopGeneration(chatHandle: ChatHandle): Promise<void>;
  abstract rotate(chatHandle: ChatHandle): Promise<ChatHandle>;
  abstract healthCheck(): Promise<{ ok: boolean; reason?: string }>;

  getManifest(): AdapterManifest {
    return {
      providerId: this.providerId,
      version: this.version,
      supportedCapabilities: ['sendPrompt', 'attachFiles', 'readResponse'],
      unsupportedCapabilities: [],
    };
  }

  // Helper: Run strategy chain for element finding
  protected async findElementByStrategies(strategies: (() => Element | null)[]): Promise<Element> {
    for (const strategy of strategies) {
      const element = strategy();
      if (element) {
        return element;
      }
    }
    throw new Error('No strategy found the element');
  }

  // Helper: Debounce
  protected debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }
}
src/adapters/chatgpt/adapter.ts
typescript
import { BaseAdapter } from '../base/adapter.js';
import type { ChatHandle, Response, AdapterManifest } from '../../shared/types.js';

export class ChatGPTAdapter extends BaseAdapter {
  constructor() {
    super('chatgpt', '1.0.0');
  }

  async detect(): Promise<{ supported: boolean; providerId: string; version: string }> {
    try {
      // Check for ChatGPT-specific elements
      // These are the most stable selectors - using data attributes where possible
      const hasMessageInput = document.querySelector('[data-testid="chat-input"]') !== null ||
                              document.querySelector('textarea[placeholder*="Message"]') !== null ||
                              document.querySelector('#prompt-textarea') !== null;

      const hasSendButton = document.querySelector('[data-testid="send-button"]') !== null ||
                           document.querySelector('button[aria-label*="Send"]') !== null;

      if (hasMessageInput && hasSendButton) {
        return { supported: true, providerId: this.providerId, version: this.version };
      }

      return { supported: false, providerId: this.providerId, version: this.version };
    } catch (err) {
      return { supported: false, providerId: this.providerId, version: this.version };
    }
  }

  async newChat(): Promise<ChatHandle> {
    // Find the "New Chat" button
    const newChatButton = document.querySelector('[data-testid="new-chat-button"]') ||
                          document.querySelector('a[href*="/new"]') ||
                          document.querySelector('button[aria-label*="New Chat"]') ||
                          document.querySelector('button[aria-label*="New"]');

    if (newChatButton && newChatButton instanceof HTMLElement) {
      newChatButton.click();
    }

    // Wait for a new chat to initialize
    await this.waitForChatReady();

    return {
      tabId: this.getTabId(),
      chatId: this.generateChatId(),
      providerId: this.providerId,
    };
  }

  async sendPrompt(chatHandle: ChatHandle, text: string): Promise<void> {
    // Find the input
    const input = await this.findMessageInput();
    
    // Type the text
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Find and click send button
    const sendButton = await this.findSendButton();
    sendButton.click();

    // Wait for the message to appear
    await this.waitForMessageSent();
  }

  async attachFiles(chatHandle: ChatHandle, files: string[]): Promise<void> {
    // ChatGPT uses a file input for attachments
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    if (!fileInput) {
      throw new Error('File input not found - ChatGPT may have changed its UI');
    }

    // For Phase 1, we're attaching by file path
    // In reality, we'd need to read the file and create a File object
    // This is a placeholder
    console.log(`[ChatGPT Adapter] Attaching files: ${files.join(', ')}`);
    
    // We'll implement actual file attachment in Phase 2
  }

  async waitUntilFinished(chatHandle: ChatHandle): Promise<Response> {
    // Wait for the "Stop generating" button to disappear
    // or for the response to be complete
    return new Promise((resolve) => {
      const checkComplete = () => {
        const stopButton = document.querySelector('[data-testid="stop-generating"]') ||
                          document.querySelector('button[aria-label*="Stop generating"]');
        
        if (!stopButton) {
          // No stop button means generation is complete (or never started)
          const responseText = this.extractResponseText();
          resolve({
            text: responseText,
            attachments: [],
            status: 'complete',
          });
        } else {
          setTimeout(checkComplete, 500);
        }
      };

      // Start checking after a delay to let generation begin
      setTimeout(checkComplete, 1000);
    });
  }

  async readResponse(chatHandle: ChatHandle): Promise<Response> {
    return {
      text: this.extractResponseText(),
      attachments: [],
      status: 'complete',
    };
  }

  async stopGeneration(chatHandle: ChatHandle): Promise<void> {
    const stopButton = document.querySelector('[data-testid="stop-generating"]') ||
                       document.querySelector('button[aria-label*="Stop generating"]');
    
    if (stopButton && stopButton instanceof HTMLElement) {
      stopButton.click();
    }
  }

  async rotate(chatHandle: ChatHandle): Promise<ChatHandle> {
    // Create a new chat and return a new handle
    return this.newChat();
  }

  async healthCheck(): Promise<{ ok: boolean; reason?: string }> {
    try {
      const result = await this.detect();
      if (result.supported) {
        // Also check if we can find the input and send button
        const hasInput = await this.findMessageInput().then(() => true).catch(() => false);
        const hasSend = await this.findSendButton().then(() => true).catch(() => false);
        
        if (hasInput && hasSend) {
          return { ok: true };
        }
        
        return { ok: false, reason: 'Could not find message input or send button' };
      }
      return { ok: false, reason: 'ChatGPT not detected' };
    } catch (err: any) {
      return { ok: false, reason: err.message };
    }
  }

  // ==================== Private Helpers ====================

  private async findMessageInput(): Promise<HTMLInputElement | HTMLTextAreaElement> {
    const strategies = [
      () => document.querySelector('[data-testid="chat-input"]'),
      () => document.querySelector('textarea[placeholder*="Message"]'),
      () => document.querySelector('#prompt-textarea'),
      () => document.querySelector('div[contenteditable="true"][role="textbox"]'),
    ];

    const element = await this.findElementByStrategies(strategies);
    return element as HTMLInputElement | HTMLTextAreaElement;
  }

  private async findSendButton(): Promise<HTMLElement> {
    const strategies = [
      () => document.querySelector('[data-testid="send-button"]'),
      () => document.querySelector('button[aria-label*="Send"]'),
      () => document.querySelector('button[aria-label*="Send message"]'),
    ];

    const element = await this.findElementByStrategies(strategies);
    return element as HTMLElement;
  }

  private async waitForChatReady(): Promise<void> {
    // Wait for the chat input to be ready
    return new Promise((resolve) => {
      const checkInput = () => {
        const input = document.querySelector('textarea[placeholder*="Message"]') ||
                     document.querySelector('[data-testid="chat-input"]');
        if (input) {
          resolve();
        } else {
          setTimeout(checkInput, 200);
        }
      };
      setTimeout(checkInput, 500);
    });
  }

  private async waitForMessageSent(): Promise<void> {
    // Wait for the user's message to appear in the chat
    return new Promise((resolve) => {
      // Find the latest message
      const checkMessage = () => {
        const messages = document.querySelectorAll('[data-testid="message"]');
        if (messages.length > 0) {
          resolve();
        } else {
          setTimeout(checkMessage, 200);
        }
      };
      setTimeout(checkMessage, 500);
    });
  }

  private extractResponseText(): string {
    // Find the latest assistant message
    const messages = document.querySelectorAll('[data-message-role="assistant"]') ||
                     document.querySelectorAll('[data-testid="message"]');
    
    if (messages.length === 0) {
      return '';
    }

    const latestMessage = messages[messages.length - 1];
    return latestMessage.textContent || '';
  }

  private getTabId(): number {
    // In the content script, we can access the tab ID
    // This is a placeholder - will be injected
    return parseInt(window.location.search.match(/tab=(\d+)/)?.[1] || '0');
  }

  private generateChatId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
Step 8: Extension
src/extension/manifest.json
json
{
  "manifest_version": 3,
  "name": "AIOS - Local AI Runtime",
  "version": "0.1.0",
  "description": "Give your web AI assistants local computer access",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs",
    "webNavigation"
  ],
  "host_permissions": [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": [
        "https://chat.openai.com/*",
        "https://chatgpt.com/*"
      ],
      "js": ["content.js"]
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["adapters/*.js"],
      "matches": ["https://chat.openai.com/*", "https://chatgpt.com/*"]
    }
  ]
}
src/extension/background/background.ts
typescript
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
src/extension/popup/popup.html
html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AIOS</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>AIOS</h1>
      <span id="status-badge" class="status-disconnected">● Disconnected</span>
    </header>

    <section id="workspace-section">
      <h2>Workspace</h2>
      <div id="workspace-info">
        <span id="workspace-name">None selected</span>
        <button id="select-workspace">Select Project</button>
      </div>
    </section>

    <section id="tabs-section">
      <h2>Connected Tabs</h2>
      <ul id="tab-list">
        <li class="empty-state">No tabs connected</li>
      </ul>
    </section>

    <section id="task-section">
      <h2>Current Task</h2>
      <div id="task-status">No active task</div>
    </section>

    <footer>
      <div id="runtime-status">Runtime: <span id="runtime-status-text">Disconnected</span></div>
      <button id="refresh-btn">↻ Refresh</button>
    </footer>
  </div>

  <script type="module" src="popup.js"></script>
</body>
</html>
src/extension/popup/popup.ts
typescript
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
src/extension/popup/popup.css
css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  width: 320px;
  min-height: 400px;
  background: #1e1e2f;
  color: #e0e0e0;
}

#app {
  padding: 16px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #333;
}

header h1 {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

#status-badge {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 12px;
}

.status-connected {
  color: #4caf50;
}

.status-disconnected {
  color: #f44336;
}

h2 {
  font-size: 13px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

section {
  margin-bottom: 16px;
}

#workspace-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #2a2a3f;
  padding: 8px 12px;
  border-radius: 6px;
}

#workspace-name {
  color: #fff;
  font-size: 13px;
}

button {
  background: #4caf50;
  color: #fff;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover {
  background: #43a047;
}

button:active {
  transform: scale(0.98);
}

#tab-list {
  list-style: none;
  background: #2a2a3f;
  border-radius: 6px;
  padding: 4px 0;
}

.tab-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  border-bottom: 1px solid #333;
}

.tab-item:last-child {
  border-bottom: none;
}

.tab-provider {
  font-size: 13px;
  color: #fff;
}

.tab-mode {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #555;
}

.tab-mode.off {
  background: #555;
  color: #999;
}

.tab-mode.manual {
  background: #2196f3;
  color: #fff;
}

.tab-mode.assistant {
  background: #ff9800;
  color: #fff;
}

.tab-mode.autonomous {
  background: #f44336;
  color: #fff;
}

.disconnect-tab {
  background: none;
  color: #888;
  padding: 0 4px;
  font-size: 14px;
}

.disconnect-tab:hover {
  color: #f44336;
  background: none;
}

.empty-state {
  color: #666;
  padding: 12px;
  text-align: center;
  font-size: 13px;
}

#task-status {
  background: #2a2a3f;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #ccc;
}

footer {
  border-top: 1px solid #333;
  padding-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #888;
}

#runtime-status-text {
  font-weight: 500;
}

#refresh-btn {
  background: #555;
  font-size: 16px;
  padding: 2px 8px;
}

#refresh-btn:hover {
  background: #666;
}

.connect-tab-btn {
  width: 100%;
  padding: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  background: #2196f3;
}

.connect-tab-btn:hover {
  background: #1976d2;
}
src/extension/content/content.ts
typescript
/// <reference types="chrome" />

import { ChatGPTAdapter } from '../../adapters/chatgpt/adapter.js';
import type { BrowserAdapter, RuntimeMessage } from '../../shared/types.js';

// ==================== Adapter Management ====================

let adapter: BrowserAdapter | null = null;

function getAdapter(): BrowserAdapter | null {
  if (adapter) return adapter;

  // Detect provider
  const url = window.location.href;
  if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
    adapter = new ChatGPTAdapter();
  }

  return adapter;
}

// ==================== Message Handling ====================

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (message.type === 'adapter_instruction') {
    handleAdapterInstruction(message.payload);
    sendResponse({ success: true });
  }
  return true;
});

async function handleAdapterInstruction(instruction: any): Promise<void> {
  const adapter = getAdapter();
  if (!adapter) {
    console.error('[AIOS] No adapter available for this page');
    return;
  }

  try {
    switch (instruction.action) {
      case 'send_prompt': {
        const chatHandle = await getOrCreateChatHandle();
        await adapter.sendPrompt(chatHandle, instruction.text);
        break;
      }

      case 'attach_files': {
        const chatHandle = await getOrCreateChatHandle();
        await adapter.attachFiles(chatHandle, instruction.files);
        break;
      }

      case 'read_response': {
        const chatHandle = await getOrCreateChatHandle();
        const response = await adapter.readResponse(chatHandle);
        sendResultToRuntime('adapter_result', { action: 'read_response', result: response });
        break;
      }

      case 'wait_until_finished': {
        const chatHandle = await getOrCreateChatHandle();
        const response = await adapter.waitUntilFinished(chatHandle);
        sendResultToRuntime('adapter_result', { action: 'response_ready', result: response });
        break;
      }

      case 'stop_generation': {
        const chatHandle = await getOrCreateChatHandle();
        await adapter.stopGeneration(chatHandle);
        break;
      }

      case 'health_check': {
        const result = await adapter.healthCheck();
        sendResultToRuntime('adapter_result', { action: 'health_check', result });
        break;
      }

      default:
        console.error('[AIOS] Unknown adapter instruction:', instruction.action);
    }
  } catch (err: any) {
    console.error('[AIOS] Adapter error:', err);
    sendResultToRuntime('adapter_error', { action: instruction.action, error: err.message });
  }
}

// ==================== Chat Handle Management ====================

let currentChatHandle: any = null;

async function getOrCreateChatHandle(): Promise<any> {
  if (currentChatHandle) return currentChatHandle;

  const adapter = getAdapter();
  if (!adapter) {
    throw new Error('No adapter available');
  }

  // Try to get the current chat
  const response = await adapter.readResponse({ tabId: 0, chatId: '', providerId: '' });
  if (response.text) {
    // We have a response, so we're in a chat
    currentChatHandle = { tabId: 0, chatId: Date.now().toString(), providerId: adapter.getManifest().providerId };
  } else {
    // Start a new chat
    currentChatHandle = await adapter.newChat();
  }

  return currentChatHandle;
}

// ==================== Communication ====================

function sendResultToRuntime(type: string, payload: any): void {
  chrome.runtime.sendMessage({
    type,
    payload,
  });
}

// ==================== Initialization ====================

console.log('[AIOS] Content script loaded');

// Run health check on load
setTimeout(async () => {
  const adapter = getAdapter();
  if (adapter) {
    const result = await adapter.healthCheck();
    if (result.ok) {
      console.log('[AIOS] Adapter health check passed');
    } else {
      console.warn('[AIOS] Adapter health check failed:', result.reason);
    }
  }
}, 1000);

// Listen for page changes (SPA navigation)
// ChatGPT uses client-side routing
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Page changed - re-check adapter
    adapter = null;
    console.log('[AIOS] Page changed, resetting adapter');
  }
}).observe(document, { subtree: true, childList: true });
Step 9: Package Configuration
package.json
json
{
  "name": "aios",
  "version": "0.1.0",
  "description": "Local AI Runtime - Turn web AI assistants into secure local agents",
  "type": "module",
  "main": "dist/runtime/index.js",
  "scripts": {
    "build": "tsc",
    "build:extension": "tsc && cp src/extension/manifest.json dist/extension/ && cp -r src/extension/popup dist/extension/ && cp -r src/extension/icons dist/extension/",
    "start": "node dist/runtime/index.js",
    "dev": "tsx watch src/runtime/index.ts",
    "test": "vitest",
    "lint": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "better-sqlite3": "^9.6.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/chrome": "^0.0.268",
    "@types/node": "^22.7.0",
    "@types/ws": "^8.5.12",
    "tsx": "^4.19.2",
    "typescript": "^5.6.2",
    "vitest": "^2.1.0"
  }
}
tsconfig.json
json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
.gitignore
text
node_modules/
dist/
*.log
*.db
data/
.DS_Store
*.swp
*.swo
*.tmp
coverage/
.vscode/
.idea/