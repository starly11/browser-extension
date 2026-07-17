# Worker

## Purpose
Define the Worker role: the Reasoning Session responsible for producing the final answer using the context the Planner gathered.

## Problem
Just as the Planner must not produce answers, the Worker must not go fetch its own context — otherwise the two roles blur back together and lose their auditability benefit.

## Goals
- Worker consumes a `ContextBundle` and produces the final response for the user.
- Worker's output is exactly what reaches the connected tab's visible chat.

## Non-Goals
- The Worker does not request files or tools.
- The Worker does not control the browser (no rotation, no attaching, no sending — that's Task Engine + Adapter's job, triggered by Runtime, not by Worker directly).
- The Worker does not decide what's "enough context" — that's already decided by the time it receives a ContextBundle.

## Responsibilities
1. Receive a `ContextBundle` from the Task Engine (produced by the Planner).
2. Produce a final answer grounded only in that bundle — if something's missing, say so; do not fabricate.
3. Optionally propose a patch/diff as part of the answer (for code-editing tasks) — proposing, not applying; application requires an explicit tool call and permission, handled by the Runtime, never by the Worker writing files itself.

## Interface
```
worker.receiveContext(contextBundle, taskId)
worker.produceAnswer() -> FinalAnswer
```

## Data Model
- `FinalAnswer { text, proposedPatches[]?, groundedIn: [toolOutputRefs] }`

## Failure Cases & Recovery
| Failure | Recovery |
|---|---|
| ContextBundle is incomplete because a tool failed earlier | Worker must explicitly note the gap in its answer rather than fill it with a plausible-sounding guess. |
| Worker's underlying browser tab disconnects mid-answer | Task moves to Recovery; if a partial answer exists, it's preserved and marked incomplete, never presented as final. |

## Future Extension
- Worker could later support multi-turn refinement (user follow-up triggers a new Planner pass rather than the Worker guessing on its own) — this is the default behavior, not an exception, per the Planner/Worker separation.

## Decision Log
- Decided the Worker may *propose* file patches but never apply them directly — patch application is a `filesystem.write()` tool call subject to the same permission model as everything else.
