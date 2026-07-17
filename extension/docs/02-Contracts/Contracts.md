# Contracts

## Purpose
The single frozen source of truth for every message shape, data structure, and state machine referenced across the architecture docs. When any two modules need to agree on a shape, it's defined here once — never redefined ad hoc inside a module's own implementation.

## Problem
Nine architecture docs each sketch fragments of the same messages (`ToolRequest`, `ToolResult`, `ContextBundle`, etc.) in slightly different shorthand. Without one canonical version, an AI implementing the Tool Engine and an AI implementing the Planner will each invent slightly incompatible shapes, and they won't talk to each other.

## Rule for implementers
If code needs a field that isn't in this document, **stop and add it here first** (with a one-line decision log entry), then implement. Never add fields to a message shape only in code.

---

## Transport Envelope (Runtime ↔ Extension, over local WebSocket)
Every message, in either direction, is wrapped:
```json
{
  "type": "string",        // message type, e.g. "TASK_CREATED", "TOOL_REQUEST"
  "id": "string",          // unique message id
  "taskId": "string|null", // present when message relates to a specific task
  "payload": { },          // type-specific body, shapes below
  "ts": "ISO-8601 string"
}
```

## Core Data Shapes

### Task
```json
{
  "id": "string",
  "workspaceId": "string",
  "prompt": "string",
  "status": "created|planning|waiting_for_tool|tool_running|worker_running|delivering|complete|stalled|delivery_failed|interrupted|archived",
  "steps": [ /* ordered log of ToolRequest/ToolResult/transition events, append-only */ ],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

### Workspace
```json
{
  "id": "string",
  "name": "string",
  "projectPath": "string",
  "connectedTabs": [ { "tabId": "string", "providerId": "string", "agentMode": "manual|assistant|autonomous" } ],
  "permissions": {
    "filesystem": "allowed|ask|denied",
    "writeFiles": "allowed|ask|denied",
    "terminal": "allowed|ask|denied",
    "git": "allowed|ask|denied",
    "browserAutomation": "allowed|ask|denied",
    "network": "allowed|ask|denied"
  },
  "createdAt": "ISO-8601",
  "lastActiveAt": "ISO-8601"
}
```

### ReasoningSession
```json
{
  "id": "string",
  "role": "planner|worker",
  "tabId": "string",
  "providerId": "string",
  "status": "idle|busy|degraded|lost"
}
```

### ToolRequest
```json
{ "tool": "string", "params": { }, "taskId": "string" }
```

### ToolResult
```json
{
  "status": "success|error|denied",
  "data": { "any": "shape, tool-specific" },
  "error": "string|null"
}
```

### ContextBundle (Planner → Worker handoff)
```json
{
  "files": [ { "path": "string", "content": "string" } ],
  "toolOutputs": [ { "tool": "string", "result": "ToolResult" } ],
  "notes": "string"
}
```

### FinalAnswer (Worker → Adapter delivery)
```json
{
  "text": "string",
  "proposedPatches": [ { "path": "string", "diff": "string" } ],
  "groundedIn": [ "references into toolOutputs/files above — every claim must trace back to one of these" ]
}
```

### Permission check result
```json
{ "tool": "string", "state": "allowed|ask|denied" }
```

---

## Task State Machine (authoritative — supersedes any informal version elsewhere)
```
created
  → planning
      → waiting_for_tool
          → tool_running
              → planning              (loop, bounded by max-iteration guard)
      → worker_running                (planner declared ready)
          → delivering
              → complete
              → delivery_failed
  → stalled                            (iteration guard tripped, or no session available)
  → interrupted                        (crash / session lost mid-flight — see Recovery.md)
→ archived                             (terminal, from complete / delivery_failed / stalled after user ack)
```
Rules:
- Only the Task Engine may write `status`. No other module mutates it directly.
- Every transition is appended to `steps[]` — the log is the audit trail; it is never rewritten, only appended to.
- `interrupted` is entered automatically on Runtime restart if a Task was in any non-terminal state at crash time (per `Recovery.md`).

## Adapter Interface (verbatim from Browser Adapter.md — repeated here because it's a contract other modules depend on)
```
detect() -> { supported: bool, providerId: string, version: string }
newChat() -> ChatHandle
sendPrompt(chatHandle, text: string) -> void
attachFiles(chatHandle, files: File[]) -> void
waitUntilFinished(chatHandle) -> Response
readResponse(chatHandle) -> Response
stopGeneration(chatHandle) -> void
rotate(chatHandle) -> ChatHandle
healthCheck() -> { ok: bool, reason?: string }
```

## Decision Log
- Decided one shared envelope wraps every Runtime↔Extension message so versioning (`type` field) and correlation (`id`, `taskId`) are handled uniformly instead of per-message-type.
- Decided `FinalAnswer.groundedIn` is mandatory, not optional, enforcing the Worker's "no fabrication" rule structurally — a Worker implementation that omits it should be treated as non-conforming.
