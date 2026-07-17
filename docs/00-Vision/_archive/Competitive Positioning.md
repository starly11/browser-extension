# Competitive Positioning

## Cursor / Windsurf / AI-native IDEs
They own the whole editor. Deep integration, but requires abandoning your existing editor and workflow.
**AIOS position**: gives Cursor-like local superpowers to whatever AI chat you already use, without asking you to switch editors.

## ChatGPT / Gemini / Claude "memory" and file-upload features
Native file upload requires manual selection every time, has size/context limits, and has no concept of your live local project state (git status, running processes, terminal output).
**AIOS position**: automatic, always-current, semantic context — no manual re-upload, no stale snapshots.

## Browser automation scripts / DOM-injection extensions (the rejected approach)
Fragile by construction — tied to a specific provider's HTML/DOM structure, breaks on every redesign, and every fix is "patch the selector" rather than "ship a feature."
**AIOS position**: explicitly designed against this failure mode — adapters are versioned, isolated, and self-testing, with the Runtime never dependent on that fragility for its core value (see Adapter Resilience.md).

## Generic MCP clients
MCP gives a model tool access, but usually inside a single AI provider's own client, not "any AI chat tab I already have open."
**AIOS position**: complementary, not competing — MCP servers are one of the Tool Protocol's supported backends. AIOS's differentiator is the browser-agnostic Reasoning Session layer sitting on top of any web AI, not the tool-calling mechanism itself.

## Positioning Statement
> AIOS is not "a browser extension." It's local computer access for whichever AI assistant you already use — plugged in through the browser you already have open, governed by permissions you can see and control at every step.
