export interface TransportEnvelope {
    type: string;
    id: string;
    taskId: string | null;
    payload: Record<string, unknown>;
    ts: string;
}
export type TaskStatus = 'created' | 'planning' | 'waiting_for_tool' | 'tool_running' | 'worker_running' | 'delivering' | 'complete' | 'stalled' | 'delivery_failed' | 'interrupted' | 'archived';
export interface Task {
    id: string;
    workspaceId: string;
    prompt: string;
    status: TaskStatus;
    steps: Array<Record<string, unknown>>;
    createdAt: string;
    updatedAt: string;
}
export type PermissionState = 'allowed' | 'ask' | 'denied';
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
    createdAt: string;
    lastActiveAt: string;
}
export type SessionRole = 'planner' | 'worker';
export type SessionStatus = 'idle' | 'busy' | 'degraded' | 'lost';
export interface ReasoningSession {
    id: string;
    role: SessionRole;
    tabId: string;
    providerId: string;
    status: SessionStatus;
}
export interface ToolRequest {
    tool: string;
    params: Record<string, unknown>;
    taskId: string;
}
export type ToolResultStatus = 'success' | 'error' | 'denied';
export interface ToolResult {
    status: ToolResultStatus;
    data?: Record<string, unknown>;
    error?: string | null;
}
export interface ContextFile {
    path: string;
    content: string;
}
export interface ContextToolOutput {
    tool: string;
    result: ToolResult;
}
export interface ContextBundle {
    files: ContextFile[];
    toolOutputs: ContextToolOutput[];
    notes: string;
}
export interface ProposedPatch {
    path: string;
    diff: string;
}
export interface FinalAnswer {
    text: string;
    proposedPatches?: ProposedPatch[];
    groundedIn: string[];
}
export interface PermissionCheckResult {
    tool: string;
    state: PermissionState;
}
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
export interface ToolDefinition {
    name: string;
    paramsSchema: Record<string, unknown>;
    requiredPermission: string;
    handler: (params: Record<string, unknown>, workspaceId: string) => Promise<ToolResult>;
}
export type SessionRequestResult = ReasoningSession | {
    unavailable: true;
};
export interface TaskEngine {
    createTask(prompt: string, workspaceId: string, tabId: string): Promise<Task>;
    getStatus(taskId: string): Promise<TaskStatus>;
    cancel(taskId: string): Promise<void>;
}
export interface WorkspaceManager {
    create(name: string, projectPath: string): Promise<Workspace>;
    switchTo(workspaceId: string): Promise<void>;
    connectTab(workspaceId: string, tabId: string, providerId: string): Promise<void>;
    disconnectTab(workspaceId: string, tabId: string): Promise<void>;
    setAgentMode(workspaceId: string, tabId: string, mode: AgentMode): Promise<void>;
    setPermission(workspaceId: string, tool: string, state: PermissionState): Promise<void>;
}
export interface SessionManager {
    requestSession(role: SessionRole, preferredProviderId?: string): SessionRequestResult;
    releaseSession(sessionId: string): void;
    getSessionStatus(sessionId: string): SessionStatus;
    onTabDisconnected(tabId: string): void;
}
export interface ToolEngine {
    registerTool(definition: ToolDefinition): void;
    execute(toolRequest: ToolRequest, workspaceId: string): Promise<ToolResult>;
}
//# sourceMappingURL=types.d.ts.map