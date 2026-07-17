# Terminology

Every future document must use these terms consistently. If a new concept is needed, add it here first.

| Term | Definition |
|---|---|
| **Runtime** | The local process that owns tasks, state, tools, and security. The "operating system" of AIOS. Always running locally. |
| **Extension** | The thin browser add-on. Connects/disconnects tabs, relays messages between the page and the Runtime. Holds no business logic. |
| **Adapter** (Browser Adapter) | A per-AI-provider implementation of a fixed interface (`sendPrompt`, `attachFiles`, `waitUntilFinished`, etc.) that knows how to operate that provider's specific web UI. |
| **Reasoning Session** | An abstract request for "an AI capable of X" (planning, solving). Not tied to a specific browser tab or provider — the Runtime picks/creates one. |
| **Planner** | A Reasoning Session role. Only allowed to request tools and evaluate their output. Never writes final answers, never talks to the user, never executes anything itself. |
| **Worker** | A Reasoning Session role. Solves the task using context the Planner gathered. Never requests files or controls the browser directly. |
| **Task** | A single unit of work, e.g. "explain how auth works." Has a formal lifecycle (see Task.md state machine). Persisted in SQLite. |
| **Workspace** | A saved bundle of: a local project path, connected tabs, permissions, and automation mode. Switching workspaces disconnects the old tabs and activates the new bundle. |
| **Tool** | A single capability exposed by the Runtime, e.g. `filesystem.read()`, `git.diff()`, `terminal.run()`. Tools are requested by Planner/Worker and executed only by the Runtime after permission checks. |
| **Tool Protocol** | The stable contract all tools obey: request shape, validation, execution, response shape, error shape. |
| **Agent Mode** | A per-tab toggle: OFF (extension does nothing), Manual (utilities only, no automation), Assistant (asks before each tool use), Autonomous (executes without per-action approval, within granted permissions). |
| **Permission** | A named grant (Filesystem, Terminal, Git, Write Files, Browser Automation, Network) with a state: Allowed / Ask Every Time / Denied. |
| **Connected Tab** | A specific browser tab the user has explicitly opted into automation for. Disconnected tabs are completely passive. |
| **Session Manager** | Runtime component that tracks which Reasoning Sessions exist, their state, and which browser tab (if any) backs them. |
| **Browser Rotation** | The process of starting a fresh chat when a conversation grows too large, reconstructing necessary context automatically, transparent to the user. |
| **Semantic Attachment** | Automatically determining which files are relevant to a request (via grep, imports, git blame, dependency graph) instead of the user manually attaching files. |
| **MCP Server** | An external Model Context Protocol server the Runtime can call as one of its tools (e.g. a database or ticketing MCP). |
