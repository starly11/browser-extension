# Workspace

## Purpose
Define the Workspace as the single unit that bundles a project, its connected tabs, its permissions, and its automation mode — so switching context is a single, safe operation.

## Problem
Without a bundling concept, permissions, connected tabs, and project path would need to be managed independently, and switching projects would risk leaking permissions or leaving stale tab connections active across unrelated projects.

## Goals
- One active Workspace at a time per Runtime instance (v1 — see Future Extension for multi-workspace).
- Switching Workspaces is atomic: old tabs disconnect, old permissions stop applying, new bundle activates as one operation.
- Workspaces are the natural unit for future team-sharing without any core architecture change.

## Non-Goals
- Workspaces do not automatically carry permissions over from one project to another, even for the same user — each Workspace's permissions are explicit and independent.

## Responsibilities
1. Store: project path, list of connected tabs (tabId + providerId), per-tool permissions, Agent Mode per connected tab.
2. Provide the atomic `switchWorkspace` operation used by the Runtime.
3. Validate that a project path still exists and is accessible on activation; fail clearly if not.

## Data Model
```
Workspace {
  id
  name
  projectPath
  connectedTabs: [ { tabId, providerId, agentMode } ]
  permissions: { filesystem, terminal, git, writeFiles, browserAutomation, network } // each: allowed|ask|denied
  createdAt, lastActiveAt
}
```

## Interface
```
workspace.create(name, projectPath)
workspace.switchTo(workspaceId)
workspace.connectTab(workspaceId, tabId, providerId)
workspace.disconnectTab(workspaceId, tabId)
workspace.setAgentMode(workspaceId, tabId, mode)
workspace.setPermission(workspaceId, tool, state)
```

## Failure Cases & Recovery
| Failure | Recovery |
|---|---|
| Switching to a Workspace whose project path no longer exists | Switch is rejected with a clear error; previous Workspace remains active until resolved. |
| A connected tab from the old Workspace is still open after switch | Extension is told to fully disconnect it; if disconnection fails (tab unresponsive), it's marked Degraded and surfaced to the user rather than left ambiguously "maybe still connected." |

## Future Extension
- Multiple simultaneously-active Workspaces (e.g. for users juggling projects side by side) — deferred past v1 to keep the atomic-switch guarantee simple first.
- Shared/team Workspaces with synced permission policy — see Roadmap Phase 3+.

## Decision Log
- Decided against any implicit permission inheritance between Workspaces — explicit re-grant per project is a deliberate friction that reinforces the trust model in `Design Principles.md` #4.
