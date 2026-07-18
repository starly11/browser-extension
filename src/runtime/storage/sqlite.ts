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
