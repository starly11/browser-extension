// shared/types.ts
// Generated from docs/02-Contracts/Contracts.md
// These types are the single source of truth for message shapes and data structures
// imported by both runtime/ and extension/

// ============================================================================
// Transport Envelope (Runtime ↔ Extension, over local WebSocket)
// Every message, in either direction, is wrapped in this envelope
// ============================================================================
export interface TransportEnvelope {
  type: string;        // message type, e.g. "TASK_CREATED", "TOOL_REQUEST"
  id: string;          // unique message id
  taskId: string | null; // present when message relates to a specific task
  payload: Record<string, unknown>; // type-specific body, shapes defined below
  ts: string;          // ISO-8601 string
}

// ============================================================================
// Core Data Shapes
// ============================================================================

// Task status values per Contracts.md state machine
export type TaskStatus =
  | 'created'
  | 'planning'
  | 'waiting_for_tool'
  | 'tool_running'
  | 'worker_running'
  | 'delivering'
  | 'complete'
  | 'stalled'
  | 'delivery_failed'
  | 'interrupted'
  | 'archived';

export interface Task {
  id: string;
  workspaceId: string;
  prompt: string;
  status: TaskStatus;
  steps: Array<Record<string, unknown>>; // ordered log of ToolRequest/ToolResult/transition events, append-only
  createdAt: string;   // ISO-8601
  updatedAt: string;   // ISO-8601
}

// Permission state for each tool type
export type PermissionState = 'allowed' | 'ask' | 'denied';

// Agent mode per connected tab
export type AgentMode = 'manual' | 'assistant' | 'autonomous';

export interface ConnectedTab {
  tabId: string;
  providerId: string;
  agentMode: AgentMode;
}

export interface WorkspacePermissions {
  filesystem: PermissionState;
  writeFiles: PermissionState;
  terminal: PermissionState;
  git: PermissionState;
  browserAutomation: PermissionState;
  network: PermissionState;
}

export interface Workspace {
  id: string;
  name: string;
  projectPath: string;
  connectedTabs: ConnectedTab[];
  permissions: WorkspacePermissions;
  createdAt: string;   // ISO-8601
  lastActiveAt: string; // ISO-8601
}

// ReasoningSession role
export type SessionRole = 'planner' | 'worker';

// ReasoningSession status
export type SessionStatus = 'idle' | 'busy' | 'degraded' | 'lost';

export interface ReasoningSession {
  id: string;
  role: SessionRole;
  tabId: string;
  providerId: string;
  status: SessionStatus;
}

// Tool request shape
export interface ToolRequest {
  tool: string;
  params: Record<string, unknown>;
  taskId: string;
}

// Tool result status
export type ToolResultStatus = 'success' | 'error' | 'denied';

export interface ToolResult {
  status: ToolResultStatus;
  data?: Record<string, unknown>; // tool-specific shape
  error?: string | null;
}

// File attachment in context bundle
export interface ContextFile {
  path: string;
  content: string;
}

// Tool output reference in context bundle
export interface ContextToolOutput {
  tool: string;
  result: ToolResult;
}

// ContextBundle: Planner → Worker handoff
export interface ContextBundle {
  files: ContextFile[];
  toolOutputs: ContextToolOutput[];
  notes: string;
}

// Proposed patch in final answer
export interface ProposedPatch {
  path: string;
  diff: string;
}

// FinalAnswer: Worker → Adapter delivery
export interface FinalAnswer {
  text: string;
  proposedPatches?: ProposedPatch[];
  groundedIn: string[]; // references into toolOutputs/files above — every claim must trace back to one of these
}

// Permission check result
export interface PermissionCheckResult {
  tool: string;
  state: PermissionState;
}

// ============================================================================
// Adapter Interface (from Browser Adapter.md, repeated in Contracts.md)
// ============================================================================
export interface AdapterDetectResult {
  supported: boolean;
  providerId: string;
  version: string;
}

export interface ChatHandle {
  tabId: string;
  chatId: string;
  providerId: string;
}

export interface AdapterResponse {
  text: string;
  attachments?: unknown[];
  status: 'complete' | 'uncertain' | 'error';
}

export interface AdapterHealthCheck {
  ok: boolean;
  reason?: string;
}

// The fixed adapter interface that every provider adapter must implement
export interface BrowserAdapter {
  detect(): AdapterDetectResult;
  newChat(): ChatHandle;
  sendPrompt(chatHandle: ChatHandle, text: string): void;
  attachFiles(chatHandle: ChatHandle, files: File[]): void;
  waitUntilFinished(chatHandle: ChatHandle): AdapterResponse;
  readResponse(chatHandle: ChatHandle): AdapterResponse;
  stopGeneration(chatHandle: ChatHandle): void;
  rotate(chatHandle: ChatHandle): ChatHandle;
  healthCheck(): AdapterHealthCheck;
}

// ============================================================================
// Tool Definitions (from Tool Engine.md)
// ============================================================================
export interface ToolDefinition {
  name: string;
  paramsSchema: Record<string, unknown>;
  requiredPermission: string;
  handler: (params: Record<string, unknown>, workspaceId: string) => Promise<ToolResult>;
}

// ============================================================================
// Session Manager Interface
// ============================================================================
export type SessionRequestResult = ReasoningSession | { unavailable: true };

// ============================================================================
// Task Engine Interface (external)
// ============================================================================
export interface TaskEngine {
  createTask(prompt: string, workspaceId: string, tabId: string): Promise<Task>;
  getStatus(taskId: string): Promise<TaskStatus>;
  cancel(taskId: string): Promise<void>;
}

// ============================================================================
// Workspace Manager Interface
// ============================================================================
export interface WorkspaceManager {
  create(name: string, projectPath: string): Promise<Workspace>;
  switchTo(workspaceId: string): Promise<void>;
  connectTab(workspaceId: string, tabId: string, providerId: string): Promise<void>;
  disconnectTab(workspaceId: string, tabId: string): Promise<void>;
  setAgentMode(workspaceId: string, tabId: string, mode: AgentMode): Promise<void>;
  setPermission(workspaceId: string, tool: string, state: PermissionState): Promise<void>;
}

// ============================================================================
// Session Manager Interface
// ============================================================================
export interface SessionManager {
  requestSession(role: SessionRole, preferredProviderId?: string): SessionRequestResult;
  releaseSession(sessionId: string): void;
  getSessionStatus(sessionId: string): SessionStatus;
  onTabDisconnected(tabId: string): void;
}

// ============================================================================
// Tool Engine Interface
// ============================================================================
export interface ToolEngine {
  registerTool(definition: ToolDefinition): void;
  execute(toolRequest: ToolRequest, workspaceId: string): Promise<ToolResult>;
}
