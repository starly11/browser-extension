# Planner

## Purpose
Define the Planner role: the Reasoning Session responsible only for figuring out what context and tools a task needs — nothing more.

## Problem
Without a hard boundary, a single AI session tends to blend "figure out what's needed" with "produce the final answer," making it impossible to reason about what the AI is allowed to do at any given moment. Splitting these into Planner and Worker roles makes each step auditable.

## Goals
- Planner requests tools, evaluates their output, and decides when there's enough context.
- Planner never produces the final user-facing answer.
- Planner's behavior is fully bounded: it can be audited step by step (see Task Drawer in `User Experience.md`).

## Non-Goals
- The Planner does not execute tools itself — it requests them; the Runtime's Tool Engine executes and validates.
- The Planner does not talk to the user directly.
- The Planner does not guess at file contents — it only knows what tool results tell it.

## Responsibilities
1. Receive the user's request (relayed from a connected tab via the Runtime).
2. Decide which tools to call (e.g. `tree`, `grep`, `git.blame`) to gather relevant context.
3. Evaluate tool results and decide: request more tools, or declare "enough context — hand off to Worker."
4. Never fabricate a tool result or a file's contents if a tool call fails — a failed tool call is reported to the Task Engine, not silently worked around.

## Forbidden Actions (law, not guideline)
- Writing code.
- Talking to the user.
- Explaining anything to the user directly.
- Guessing file contents instead of requesting them.
- Executing any tool directly — only requesting.

## Interface
```
planner.receiveRequest(userPrompt, taskId)
planner.requestTools(toolCalls[])   -> emitted as ToolRequest events to the Task Engine
planner.onToolResult(result)
planner.declareReady(contextBundle)  -> hands off to Worker
```

## Data Model
- `ToolRequest { tool, params }`
- `ContextBundle { files[], toolOutputs[], notes }` — handed to the Worker, fully traceable back to real tool outputs (per the "no fabrication" self-check gate philosophy already used in other AIOS-adjacent projects).

## Failure Cases & Recovery
| Failure | Recovery |
|---|---|
| Planner requests a tool the user hasn't permitted | Tool Engine rejects with a clear reason; Planner must either ask a permitted alternative or declare the task blocked — never invent a substitute answer. |
| Planner loops indefinitely requesting tools | Task Engine enforces a max-iteration guard (see `Task Engine.md`) and surfaces "context gathering stalled" to the user. |
| Underlying Reasoning Session (browser tab) disconnects mid-planning | Task moves to Recovery per `Recovery.md`; partial context bundle is preserved if possible. |

## Future Extension
- Planner and Worker may run on different providers entirely (e.g. a fast/cheap model plans, a stronger model solves) — the interface above already supports this since Planner and Worker only communicate through the Task Engine, never directly.

## Decision Log
- Decided Planner and Worker are strictly separate roles (not just prompt-engineered personas) so permission and audit logic can be enforced structurally, not just requested nicely of the model.
