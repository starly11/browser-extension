# Session Manager

## Purpose
Track every Reasoning Session (Planner or Worker role) and which browser tab, if any, currently backs it — abstracting "which AI provider" away from the rest of the system.

## Problem
Tasks need "a reasoning session capable of planning" or "capable of solving" without caring whether that's ChatGPT, Claude, or Gemini, or whether it's the same tab as before. Without this abstraction, Task Engine logic would be littered with provider-specific branching.

## Goals
- Provide `requestSession(role)` that returns a usable Reasoning Session, regardless of provider.
- Track session health (via Adapter `healthCheck()`) and reassign or recover as needed.
- Support the same Task using two different sessions for Planner and Worker roles, possibly on different providers, transparently.

## Non-Goals
- Session Manager does not implement any provider-specific logic itself — it delegates to Adapters via the Extension.
- It does not decide task content — purely session lifecycle and health.

## Responsibilities
1. Maintain a registry: `ReasoningSession { id, role, tabId, providerId, status }`.
2. On request, pick an existing healthy connected tab matching the needed role/provider, or signal that none is available (user must connect one).
3. Monitor session health via periodic Adapter `healthCheck()` calls; mark sessions Degraded on failure per `Adapter Resilience.md`.
4. Coordinate Chat Rotation (see `03-Features/Chat Rotation.md`) when a session's conversation grows too large, without the Task Engine needing to know rotation happened.

## Interface
```
sessionManager.requestSession(role: planner|worker, preferredProviderId?) -> ReasoningSession | Unavailable
sessionManager.releaseSession(sessionId)
sessionManager.getSessionStatus(sessionId)
sessionManager.onTabDisconnected(tabId)
```

## Data Model
```
ReasoningSession {
  id
  role: planner | worker
  tabId
  providerId
  status: idle | busy | degraded | lost
}
```

## Failure Cases & Recovery
| Failure | Recovery |
|---|---|
| No connected tab can serve the requested role | `requestSession` returns Unavailable; Task Engine surfaces "connect a tab to continue" to the user rather than silently blocking forever. |
| A session goes Degraded mid-task (adapter health check fails) | Session Manager marks it Degraded; Task Engine is notified and moves the Task to Recovery, attempting to hand off to another healthy session if the Workspace has one, otherwise pausing and informing the user. |
| Tab disconnected by user mid-task | Session marked `lost`; any in-flight Task tied to it moves to Recovery immediately, not silently retried against a session that no longer exists. |

## Future Extension
- Session pooling for concurrent Tasks.
- Cross-provider Planner/Worker pairing as a first-class, user-configurable preference.

## Decision Log
- Decided sessions are requested by *role*, never by tab ID directly, from the Task Engine's perspective — this is what makes provider-swapping and multi-provider pairing possible without touching Task Engine code.
