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
