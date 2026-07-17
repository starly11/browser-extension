# Task Engine

## Purpose
Own the full lifecycle of a Task from user request to completion, coordinating Planner, Worker, Tool Engine, and Adapter without any of those components talking to each other directly.

## Problem
Without a central coordinator, Planner/Worker/Tools/Adapter would need to know about each other directly, recreating tight coupling and making the failure-recovery story incoherent. The Task Engine is the single place that knows the full sequence and can enforce guards (iteration limits, permission checks, timeouts).

## Goals
- Every Task has one authoritative status at all times, persisted durably.
- Task Engine is the only component that transitions a Task between states.
- Task Engine enforces safety guards: max Planner iterations, tool permission checks before dispatch, timeouts on Adapter operations.

## Non-Goals
- Task Engine does not itself reason about content — it only sequences Planner → Tool Engine → Worker → Adapter calls per the Task state machine.

## Responsibilities
1. Create a Task on user request (relayed via Runtime from a connected tab).
2. Invoke Planner; receive ToolRequests; forward each to the Tool Engine only after a permission check.
3. Feed tool results back to Planner until it declares readiness or a guard trips.
4. Hand the resulting ContextBundle to the Worker.
5. Take the Worker's FinalAnswer and instruct the Adapter (via Runtime → Extension) to deliver it into the connected tab.
6. Persist every transition to Storage so a crash mid-task is always recoverable (see `Recovery.md`).

## Interface
```
taskEngine.createTask(prompt, workspaceId, tabId) -> Task
taskEngine.getStatus(taskId) -> TaskStatus
taskEngine.cancel(taskId)
```
Internal (not exposed outside the Runtime):
```
taskEngine.dispatchToPlanner(taskId)
taskEngine.dispatchToolRequest(taskId, toolRequest) // permission-checked
taskEngine.dispatchToWorker(taskId, contextBundle)
taskEngine.deliverAnswer(taskId, finalAnswer)
```

## Guards
- **Max Planner iterations**: default 6 tool-request rounds before forcing a "context gathering stalled" state, surfaced to the user rather than looping forever.
- **Per-tool timeout**: any tool call exceeding its budget is treated as failed, not hung.
- **Permission gate**: every ToolRequest is checked against the active Workspace's permissions before being forwarded to the Tool Engine — no exceptions, no "trusted" tool bypass.

## Data Model
See `05-State Machines/Task.md` for the full state machine (Created → Planning → Waiting for Tool → ... → Complete/Archived).

## Failure Cases & Recovery
| Failure | Recovery |
|---|---|
| Planner iteration guard trips | Task → "Stalled," user notified with what was gathered so far; user may manually continue or cancel. |
| Tool permission denied | Task Engine surfaces this to Planner as a ToolResult of type "denied," never silently drops the request. |
| Adapter delivery fails (tab closed, health check failed) | Task → "Delivery Failed," FinalAnswer preserved in Storage so it isn't lost; user can view it via Task Drawer even if it never reached the tab. |

## Future Extension
- Multiple concurrent Tasks per Workspace, each independently guarded and recoverable.

## Decision Log
- Decided permission checks happen in the Task Engine, not the Tool Engine, so denials are visible as part of the Task's auditable history rather than a silent tool-layer rejection.
