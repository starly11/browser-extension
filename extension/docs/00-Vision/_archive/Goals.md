# Goals

## v1 Goals (must be true at first ship)
1. A user can install the extension, select a local project folder, and connect one browser tab (ChatGPT or Claude) in under 2 minutes with zero configuration screens.
2. A natural-language request in a connected tab results in automatically-attached, relevant local files — with no manual file selection.
3. No tool executes without an explicit permission grant, visible to the user at the time of the grant.
4. Disconnecting a tab, or setting Agent Mode to OFF, immediately and completely stops all automation for that tab — verified, not assumed.
5. If a provider changes its web UI, the adapter for that provider can be replaced without changing the Planner, Worker, Tool Protocol, or Runtime core.
6. All task state survives a browser crash — the user can reopen the tab and the task resumes or is clearly marked as abandoned, never silently lost.
7. A coding model (Qwen Coder or equivalent) can implement each module from its specification document alone, without needing clarifying questions about architecture.

## Post-v1 Goals
- Support 3+ AI providers with adapters of equal quality.
- Desktop app and VS Code plugin sharing the same runtime.
- Team workspaces with shared permission policies.
- Browser rotation (auto new-chat + context reconstruction) working transparently for long conversations.

## Explicit Non-Goal-for-v1 (deferred, not rejected)
- Cloud sync of workspaces/permissions.
- Multi-provider Planner/Worker split (e.g. Gemini plans, Claude solves) — v1 ships single-provider Reasoning Sessions first.
