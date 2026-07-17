"use strict";
/**
 * Storage Layer - SQLite persistence for Runtime
 * Per Runtime.md: "Owns all Tool execution — nothing outside the Runtime ever touches the filesystem, terminal, or git directly."
 * Per Contracts.md: Persists Task, Workspace, ReasoningSession, Permission shapes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Storage = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
class Storage {
    db;
    constructor(config = {}) {
        const dbPath = config.dbPath || path_1.default.join(process.cwd(), 'aios-runtime.db');
        this.db = new better_sqlite3_1.default(dbPath);
        this.initializeSchema();
    }
    initializeSchema() {
        // Enable foreign keys
        this.db.pragma('foreign_keys = ON');
        // Workspaces table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        projectPath TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        lastActiveAt TEXT NOT NULL
      )
    `);
        // Connected tabs (stored as JSON for simplicity in v1)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_tabs (
        workspaceId TEXT NOT NULL,
        tabId TEXT NOT NULL,
        providerId TEXT NOT NULL,
        agentMode TEXT NOT NULL DEFAULT 'manual',
        PRIMARY KEY (workspaceId, tabId),
        FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE
      )
    `);
        // Permissions table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        workspaceId TEXT NOT NULL,
        tool TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('allowed', 'ask', 'denied')),
        PRIMARY KEY (workspaceId, tool),
        FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE
      )
    `);
        // Tasks table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('created', 'planning', 'waiting_for_tool', 'tool_running', 'worker_running', 'delivering', 'complete', 'stalled', 'delivery_failed', 'interrupted', 'archived')),
        steps TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (workspaceId) REFERENCES workspaces(id)
      )
    `);
        // Reasoning sessions table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS reasoning_sessions (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK(role IN ('planner', 'worker')),
        tabId TEXT NOT NULL,
        providerId TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('idle', 'busy', 'degraded', 'lost')),
        createdAt TEXT NOT NULL
      )
    `);
        // Auth tokens table (for Extension ↔ Runtime transport auth)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        value TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL,
        workspaceId TEXT
      )
    `);
    }
    // ============================================================================
    // Workspace operations
    // ============================================================================
    createWorkspace(name, projectPath) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO workspaces (id, name, projectPath, createdAt, lastActiveAt)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(id, name, projectPath, now, now);
        // Initialize default permissions
        const defaultTools = ['filesystem', 'writeFiles', 'terminal', 'git', 'browserAutomation', 'network'];
        const permStmt = this.db.prepare(`
      INSERT INTO permissions (workspaceId, tool, state)
      VALUES (?, ?, 'ask')
    `);
        for (const tool of defaultTools) {
            permStmt.run(id, tool);
        }
        return this.getWorkspace(id);
    }
    getWorkspace(id) {
        const wsStmt = this.db.prepare('SELECT * FROM workspaces WHERE id = ?');
        const workspace = wsStmt.get(id);
        if (!workspace) {
            throw new Error(`Workspace ${id} not found`);
        }
        // Get connected tabs
        const tabsStmt = this.db.prepare('SELECT tabId, providerId, agentMode FROM workspace_tabs WHERE workspaceId = ?');
        const tabs = tabsStmt.all(id);
        // Get permissions
        const permStmt = this.db.prepare('SELECT tool, state FROM permissions WHERE workspaceId = ?');
        const perms = permStmt.all(id);
        const permMap = {};
        for (const p of perms) {
            permMap[p.tool] = p.state;
        }
        const permissions = {
            filesystem: permMap['filesystem'] || 'ask',
            writeFiles: permMap['writeFiles'] || 'ask',
            terminal: permMap['terminal'] || 'ask',
            git: permMap['git'] || 'ask',
            browserAutomation: permMap['browserAutomation'] || 'ask',
            network: permMap['network'] || 'ask',
        };
        return {
            id: workspace.id,
            name: workspace.name,
            projectPath: workspace.projectPath,
            connectedTabs: tabs.map(t => ({
                tabId: t.tabId,
                providerId: t.providerId,
                agentMode: t.agentMode
            })),
            permissions: permissions,
            createdAt: workspace.createdAt,
            lastActiveAt: workspace.lastActiveAt
        };
    }
    switchWorkspace(workspaceId) {
        // Verify workspace exists
        this.getWorkspace(workspaceId);
        // Update lastActiveAt
        const stmt = this.db.prepare(`
      UPDATE workspaces SET lastActiveAt = ? WHERE id = ?
    `);
        stmt.run(new Date().toISOString(), workspaceId);
    }
    connectTab(workspaceId, tabId, providerId, agentMode = 'manual') {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workspace_tabs (workspaceId, tabId, providerId, agentMode)
      VALUES (?, ?, ?, ?)
    `);
        stmt.run(workspaceId, tabId, providerId, agentMode);
        // Update workspace lastActiveAt
        this.switchWorkspace(workspaceId);
    }
    disconnectTab(workspaceId, tabId) {
        const stmt = this.db.prepare('DELETE FROM workspace_tabs WHERE workspaceId = ? AND tabId = ?');
        stmt.run(workspaceId, tabId);
    }
    setAgentMode(workspaceId, tabId, mode) {
        const stmt = this.db.prepare(`
      UPDATE workspace_tabs SET agentMode = ? WHERE workspaceId = ? AND tabId = ?
    `);
        stmt.run(mode, workspaceId, tabId);
    }
    setPermission(workspaceId, tool, state) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO permissions (workspaceId, tool, state)
      VALUES (?, ?, ?)
    `);
        stmt.run(workspaceId, tool, state);
    }
    getPermission(workspaceId, tool) {
        const stmt = this.db.prepare('SELECT state FROM permissions WHERE workspaceId = ? AND tool = ?');
        const result = stmt.get(workspaceId, tool);
        return result?.state || 'ask';
    }
    // ============================================================================
    // Task operations
    // ============================================================================
    createTask(workspaceId, prompt) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO tasks (id, workspaceId, prompt, status, steps, createdAt, updatedAt)
      VALUES (?, ?, ?, 'created', '[]', ?, ?)
    `);
        stmt.run(id, workspaceId, prompt, now, now);
        return this.getTask(id);
    }
    getTask(id) {
        const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
        const task = stmt.get(id);
        if (!task) {
            throw new Error(`Task ${id} not found`);
        }
        return {
            id: task.id,
            workspaceId: task.workspaceId,
            prompt: task.prompt,
            status: task.status,
            steps: JSON.parse(task.steps),
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
        };
    }
    updateTaskStatus(id, status, step) {
        const now = new Date().toISOString();
        // Get current task to append step if provided
        const current = this.getTask(id);
        let steps = current.steps;
        if (step) {
            steps = [...steps, { ...step, timestamp: now }];
        }
        const stmt = this.db.prepare(`
      UPDATE tasks SET status = ?, steps = ?, updatedAt = ? WHERE id = ?
    `);
        stmt.run(status, JSON.stringify(steps), now, id);
        return this.getTask(id);
    }
    getTasksByWorkspace(workspaceId) {
        const stmt = this.db.prepare('SELECT * FROM tasks WHERE workspaceId = ? ORDER BY createdAt DESC');
        const rows = stmt.all(workspaceId);
        return rows.map(row => ({
            id: row.id,
            workspaceId: row.workspaceId,
            prompt: row.prompt,
            status: row.status,
            steps: JSON.parse(row.steps),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }));
    }
    // ============================================================================
    // Reasoning Session operations
    // ============================================================================
    createSession(role, tabId, providerId) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO reasoning_sessions (id, role, tabId, providerId, status, createdAt)
      VALUES (?, ?, ?, ?, 'idle', ?)
    `);
        stmt.run(id, role, tabId, providerId, now);
        return this.getSession(id);
    }
    getSession(id) {
        const stmt = this.db.prepare('SELECT * FROM reasoning_sessions WHERE id = ?');
        const session = stmt.get(id);
        if (!session) {
            throw new Error(`ReasoningSession ${id} not found`);
        }
        return {
            id: session.id,
            role: session.role,
            tabId: session.tabId,
            providerId: session.providerId,
            status: session.status
        };
    }
    updateSessionStatus(id, status) {
        const stmt = this.db.prepare(`
      UPDATE reasoning_sessions SET status = ? WHERE id = ?
    `);
        stmt.run(status, id);
        return this.getSession(id);
    }
    getSessionsByTab(tabId) {
        const stmt = this.db.prepare('SELECT * FROM reasoning_sessions WHERE tabId = ?');
        const rows = stmt.all(tabId);
        return rows.map(row => ({
            id: row.id,
            role: row.role,
            tabId: row.tabId,
            providerId: row.providerId,
            status: row.status
        }));
    }
    deleteSession(id) {
        const stmt = this.db.prepare('DELETE FROM reasoning_sessions WHERE id = ?');
        stmt.run(id);
    }
    // ============================================================================
    // Auth token operations
    // ============================================================================
    createAuthToken(workspaceId) {
        const value = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO auth_tokens (value, createdAt, workspaceId)
      VALUES (?, ?, ?)
    `);
        stmt.run(value, now, workspaceId || null);
        return value;
    }
    validateAuthToken(token) {
        const stmt = this.db.prepare('SELECT value FROM auth_tokens WHERE value = ?');
        const result = stmt.get(token);
        return !!result;
    }
    // ============================================================================
    // Recovery operations - get interrupted tasks
    // ============================================================================
    getInterruptedTasks() {
        const stmt = this.db.prepare("SELECT * FROM tasks WHERE status IN ('planning', 'waiting_for_tool', 'tool_running', 'worker_running', 'delivering')");
        const rows = stmt.all();
        return rows.map(row => ({
            id: row.id,
            workspaceId: row.workspaceId,
            prompt: row.prompt,
            status: 'interrupted',
            steps: JSON.parse(row.steps),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }));
    }
    markTasksAsInterrupted() {
        const stmt = this.db.prepare(`
      UPDATE tasks 
      SET status = 'interrupted', updatedAt = ? 
      WHERE status IN ('planning', 'waiting_for_tool', 'tool_running', 'worker_running', 'delivering')
    `);
        stmt.run(new Date().toISOString());
    }
    // ============================================================================
    // Cleanup
    // ============================================================================
    close() {
        this.db.close();
    }
}
exports.Storage = Storage;
exports.default = Storage;
//# sourceMappingURL=index.js.map