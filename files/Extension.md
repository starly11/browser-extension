# Extension

## Purpose
Define the boundaries of the browser extension — deliberately the "dumbest" component in the system.

## Problem
If the extension accumulates logic (planning, decision-making, persistent state), it becomes a second source of truth and starts duplicating what the Runtime owns. History shows this is how browser-automation products rot: logic creeps into the one place that's hardest to keep consistent (per-tab content scripts).

## Goals
- Keep the extension a thin relay: UI (popup/dashboard) + tab connection management + adapter invocation.
- Make it trivial to reason about: "what can this extension do that the user didn't ask for?" Answer must always be "nothing."

## Non-Goals
- No planning, no decision-making, no persistent business state beyond the current message being relayed.
- No direct filesystem/terminal/git access — the extension has zero tool execution capability itself; it only asks the Runtime to run tools.

## Responsibilities
1. **Popup UI** — renders Runtime status, connected tabs, Agent Mode toggle (data owned by Runtime, rendered by Extension).
2. **Tab Connection Management** — lets the user explicitly connect/disconnect the current tab; reports this to the Runtime, does not decide it.
3. **Adapter Host** — loads the correct provider Adapter (see `Browser Adapter.md`) into a connected tab's content script context.
4. **Message Relay** — passes Runtime instructions ("send this prompt," "attach these files") into the Adapter, and Adapter results back to the Runtime. It does not interpret or alter these messages.
5. **Local Transport Client** — maintains the connection to the local Runtime process.

## Interfaces
```
extension.onConnectTabClicked(tabId)
extension.onDisconnectTabClicked(tabId)
extension.onAgentModeChanged(tabId, mode)
extension.relayToAdapter(tabId, instruction)
extension.relayToRuntime(tabId, adapterResult)
```

## Data Model
The extension holds only ephemeral UI state (which popup screen is open, which tab is currently focused). Everything durable — connected tabs, permissions, Agent Mode per tab — is Runtime state, merely *displayed* by the extension.

## Failure Cases & Recovery
| Failure | Recovery |
|---|---|
| Extension background script restarts (browser update, crash) | Re-fetches current state from Runtime on wake; never assumes stale local state is correct. |
| Runtime not reachable | Popup shows "Runtime Disconnected" clearly; all tabs are treated as effectively disconnected until Runtime returns — fails closed, not open. |
| User closes a connected tab | Extension reports tab closure to Runtime immediately; Session Manager marks any backed Reasoning Session as lost and handles per `Recovery.md`. |

## Future Extension
- Same relay pattern is reused for Firefox/Edge builds and, later, a Desktop app's own "adapter host" equivalent for non-browser interfaces.

## Decision Log
- Decided against caching permission/workspace state locally in the extension beyond the current session, to avoid a stale-state class of bugs where the extension acts on outdated permissions.
