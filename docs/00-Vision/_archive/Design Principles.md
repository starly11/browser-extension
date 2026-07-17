# Design Principles

These principles are law. Every future document and every line of code must be checked against them. If a design decision violates one of these, the design is wrong, not the principle.

## 1. The Runtime is the source of truth. Browser AI sessions are disposable reasoning engines.
Nothing important lives inside a browser tab. If Chrome crashes, nothing is lost. The runtime can reconstruct any session from SQLite state.

## 2. The extension is dumb by design.
The extension only: connects/disconnects tabs, relays messages, injects/reads DOM content via an adapter. It never plans, never decides, never holds state longer than the current message.

## 3. Contracts are frozen; implementations are disposable.
Adapters, tools, and protocols are defined by their interface (e.g. `sendPrompt()`, `filesystem.read()`). The interface almost never changes. The implementation behind it can change every week without breaking anything above it.

## 4. Nothing is automatic until the user says so.
No tab is controlled unless explicitly connected. No tool runs unless its permission is granted. No task starts unless Agent Mode is enabled for that tab. Opt-in, always, at every layer.

## 5. AI never executes anything directly.
The AI (Planner/Worker) can only *request* a tool. The Runtime validates and executes it. There is no code path from "AI generates a string" to "shell executes a string."

## 6. Every capability is a tool, not a hardcoded behavior.
`filesystem.read()`, `terminal.run()`, `git.diff()` are all tools behind one Tool Protocol. Adding a capability means adding a tool, not modifying the runtime core.

## 7. Failure is a first-class state, not an exception.
Every state machine (Task, Browser Session, Planner, Worker) has explicit failure and recovery states. "It broke silently" is not an acceptable outcome anywhere in the system.

## 8. The user should be able to forget the extension exists.
Once a workspace is set up, the AI chat looks and behaves exactly as it always has. Magic happens underneath; nothing new is bolted onto the visible chat UI unless the user opens the popup/dashboard on purpose.

## 9. Vision, Runtime, and Developer concerns are documented separately.
Product docs describe what the user experiences. Architecture docs describe how it works. Developer docs describe how contributors write code. These are never mixed in the same document.

## 10. Degrade gracefully, never fail silently.
If an adapter can't find an element, if a permission is missing, if a browser tab disconnects mid-task — the system drops to a safer, more manual state and tells the user, rather than guessing or pretending to succeed.
