# Runtime

## Purpose
Define the Runtime: the always-on local process that owns every piece of state, every tool execution, and every security decision in AIOS.

## Problem
Without a single owning process, state ends up scattered across browser tabs, extension background scripts, and page memory — all of which can vanish on a crash or reload. AIOS needs one process that is authoritative, so nothing important depends on a browser tab staying open.

## Goals
- Be the single source of truth for Tasks, Workspaces, Sessions, and Permissions.
- Own all Tool execution — nothing outside the Runtime ever touches the filesystem, terminal, or git directly.
- Survive browser crashes and tab closures without losing task state.
- Expose a stable protocol so the Extension, and eventually a Desktop app or VS Code plugin, can all drive the same Runtime.

## Non-Goals
- The Runtime does not render any UI itself (the Extension popup/dashboard does).
- The Runtime does not implement AI reasoning — it only orchestrates Reasoning Sessions hosted in browser tabs (or, later, other interfaces).
- The Runtime does not directly manipulate any web page DOM — that is the Adapter's job, invoked through the Extension.

## Responsibilities
1. **Task Manager** — owns Task lifecycle (see `05-State Machines/Task.md`).
2. **Tool Engine** — validates and executes tool calls (see `Tool Engine.md`).
3. **Session Manager** — tracks Reasoning Sessions and their backing tabs (see `Session Manager.md`).
4. **Workspace Manager** — owns active Workspace, permissions, connected tabs (see `Workspace.md`).
5. **Storage** — persists all of the above (see `Storage.md`).
6. **Security Layer** — permission checks, execution sandboxing (see `Security.md`).
7. **Recovery Manager** — detects interrupted state on startup and resolves it (see `Recovery.md`).

## Interfaces
The Runtime exposes a local protocol (see `02-Protocols/Runtime Protocol.md`) over a local-only transport (e.g. a loopback WebSocket/IPC channel — exact transport decided in the Protocol doc, not here). Conceptually:

```
runtime.createTask(request)
runtime.getTaskStatus(taskId)
runtime.cancelTask(taskId)
runtime.connectTab(tabId, provider)
runtime.disconnectTab(tabId)
runtime.setAgentMode(tabId, mode)
runtime.getWorkspace()
runtime.switchWorkspace(workspaceId)
runtime.getPermissions(workspaceId)
runtime.setPermission(workspaceId, tool, state)
```

## Data Model (conceptual — full schema in 99-Appendix/JSON Schemas.md)
- `Task { id, prompt, status, steps[], createdAt, workspaceId }`
- `Workspace { id, projectPath, connectedTabs[], permissions{}, agentModeByTab{} }`
- `ReasoningSession { id, role(planner|worker), tabId, providerId, status }`
- `Permission { tool, state(allowed|ask|denied) }`

## Failure Cases & Recovery
| Failure | Recovery |
|---|---|
| Runtime process crashes mid-task | On restart, Recovery Manager loads last known Task state from Storage and marks it "Interrupted" — never silently resumes destructive actions. |
| Extension disconnects (browser closed) | Runtime keeps running; Tasks pause; on reconnect, Session Manager reattaches or recreates sessions. |
| Storage corruption | Runtime refuses to run automation until Storage integrity is confirmed; falls back to a safe read-only state. |

## Future Extension
- Multiple interfaces (Desktop app, VS Code plugin) connecting to the same Runtime instance concurrently.
- Remote Runtime (team/cloud) — deferred, see Roadmap.

## Decision Log
- Decided the Runtime is a separate local process from the browser extension background script, not merged into it, so it can outlive the browser entirely (supports Desktop/VS Code future use).
- Decided all Tool execution is centralized in the Runtime, never delegated to the Extension, per Design Principles #2 and #6.
