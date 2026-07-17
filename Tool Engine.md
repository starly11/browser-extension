# Tool Engine

## Purpose
Be the single, centralized place where every tool (filesystem, terminal, git, docker, browser, MCP) is validated and executed. This is the component that makes "AI never executes anything directly" true in practice, not just in principle.

## Problem
If tool execution were scattered (e.g. Planner directly shelling out, or the Extension running arbitrary commands), there would be no single choke point for permission checks, logging, or sandboxing — and no way to guarantee the "no `exec(anything)` on raw AI output" rule from `Security.md`.

## Goals
- Every tool call passes through exactly one code path: request → schema validation → permission check → execution → structured result.
- New tools are added by registering a new entry against the Tool Protocol — never by adding a special case to the engine itself.
- No tool ever receives raw, unvalidated AI-generated text as something to execute verbatim.

## Non-Goals
- The Tool Engine does not decide *whether* a tool call makes sense for the task (that's Planner/Worker's job) — it only decides whether the call is well-formed and permitted, then executes it faithfully.

## Responsibilities
1. Maintain the Tool Registry: each tool's name, parameter schema, required permission, and handler.
2. Validate incoming ToolRequests against the registered schema — reject malformed calls before they reach any handler.
3. Check the calling Workspace's permission state for that tool (Allowed / Ask / Denied) before execution.
4. Execute the tool via its handler in a constrained way (see `Security.md` for sandboxing specifics).
5. Return a structured `ToolResult` — success, error, or denied — never a bare exception or raw stdout dump without structure.

## Interface
```
toolEngine.registerTool(definition: ToolDefinition)
toolEngine.execute(toolRequest, workspaceId) -> ToolResult
```

## Example Registered Tools
```
filesystem.read(path)
filesystem.search(query)
filesystem.attach(path)
terminal.run(command, args[])       // never raw shell string concatenation
git.diff(ref?)
git.status()
git.blame(path)
docker.logs(containerId)
browser.capture(tabId)
mcp.call(serverId, toolName, params)
```

## Data Model
```
ToolDefinition { name, paramsSchema, requiredPermission, handler }
ToolRequest { tool, params, taskId }
ToolResult { status: success|error|denied, data?, error? }
```

## Failure Cases & Recovery
| Failure | Recovery |
|---|---|
| ToolRequest fails schema validation | Rejected immediately with `status: error`, reason included — never partially executed. |
| Permission state is "Ask" | Execution pauses; Task Engine surfaces an approval prompt to the user; proceeds only on explicit approval, per Task. |
| Permission state is "Denied" | Rejected with `status: denied`; Planner must adapt or the Task reports the limitation to the user. |
| Tool handler throws/crashes | Caught at the Tool Engine boundary, returned as `status: error` — never allowed to crash the Runtime process. |

## Future Extension
- MCP servers registered as tool sources dynamically, following the same registration and permission-check path as built-in tools — no special-casing.

## Decision Log
- Decided `terminal.run()` takes a command name and an argument array, never a single interpolated shell string, closing off shell-injection risk structurally rather than via sanitization (see `Security.md`).
