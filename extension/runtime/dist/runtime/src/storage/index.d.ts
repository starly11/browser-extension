/**
 * Storage Layer - SQLite persistence for Runtime
 * Per Runtime.md: "Owns all Tool execution — nothing outside the Runtime ever touches the filesystem, terminal, or git directly."
 * Per Contracts.md: Persists Task, Workspace, ReasoningSession, Permission shapes
 */
import { Task, TaskStatus, Workspace, PermissionState, ReasoningSession, SessionStatus } from '@shared/types';
export interface StorageConfig {
    dbPath?: string;
}
export declare class Storage {
    private db;
    constructor(config?: StorageConfig);
    private initializeSchema;
    createWorkspace(name: string, projectPath: string): Workspace;
    getWorkspace(id: string): Workspace;
    switchWorkspace(workspaceId: string): void;
    connectTab(workspaceId: string, tabId: string, providerId: string, agentMode?: 'manual' | 'assistant' | 'autonomous'): void;
    disconnectTab(workspaceId: string, tabId: string): void;
    setAgentMode(workspaceId: string, tabId: string, mode: 'manual' | 'assistant' | 'autonomous'): void;
    setPermission(workspaceId: string, tool: string, state: PermissionState): void;
    getPermission(workspaceId: string, tool: string): PermissionState;
    createTask(workspaceId: string, prompt: string): Task;
    getTask(id: string): Task;
    updateTaskStatus(id: string, status: TaskStatus, step?: Record<string, unknown>): Task;
    getTasksByWorkspace(workspaceId: string): Task[];
    createSession(role: 'planner' | 'worker', tabId: string, providerId: string): ReasoningSession;
    getSession(id: string): ReasoningSession;
    updateSessionStatus(id: string, status: SessionStatus): ReasoningSession;
    getSessionsByTab(tabId: string): ReasoningSession[];
    deleteSession(id: string): void;
    createAuthToken(workspaceId?: string): string;
    validateAuthToken(token: string): boolean;
    getInterruptedTasks(): Task[];
    markTasksAsInterrupted(): void;
    close(): void;
}
export default Storage;
//# sourceMappingURL=index.d.ts.map