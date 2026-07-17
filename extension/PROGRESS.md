# PROGRESS

> This file is the project's memory. You (the coding agent) have no memory between sessions — this file is the only thing that persists. Read it fully before doing anything. Update it before you stop, every session, no exceptions.

## Current Phase
`PHASE_1_SKELETON`
<!-- One of: PHASE_1_SKELETON | PHASE_2_SEMANTIC_ATTACH | PHASE_3_PLANNER_WORKER | PHASE_4_RECOVERY | PHASE_5_SECOND_PROVIDER -->

## Build Order Checklist (per Build_Guide.md — do not reorder, do not skip ahead)
- [x] `shared/types.ts` generated from `docs/02-Contracts/Contracts.md` (already existed, verified against Contracts.md)
- [x] Runtime skeleton: SQLite storage layer, WS transport + token auth (implemented and verified - server starts successfully on ws://127.0.0.1:8765)
- [x] Extension skeleton: manifest, popup (connect/disconnect only), background relay (implemented and pushed - includes manifest.json, src/popup/, src/background/, src/content/ with basic adapter implementations for ChatGPT, Claude, Gemini)
- [x] One Adapter implemented (provider: ChatGPT) - Full implementation with strategy chain pattern, 9 interface methods, resilient DOM selection
- [x] Tool Engine + `filesystem.attach(path)` (manual path) - Implemented with read/write/list operations, sandbox security, tool registry
- [ ] Walking skeleton verified end-to-end (typed path → file lands in connected tab)
- [ ] Semantic attachment tool (grep + import graph + git blame)
- [ ] Task Engine + Planner/Worker split
- [ ] Permission gate (Allowed/Ask/Denied) wired through Task Engine
- [ ] Iteration guard on Planner loop
- [ ] Recovery: crash → Interrupted state per Contracts.md state machine
- [ ] Second Adapter
- [ ] Agent Mode (manual/assistant/autonomous) per tab
- [ ] Chat rotation

## Last Session Summary
<!-- Overwritten each session. What did you do, what did you verify, what's left mid-flight. -->
- Implemented Tool Engine with registry pattern in `runtime/src/tools/index.ts` supporting dynamic tool registration and invocation
- Created Filesystem Tool in `runtime/src/tools/filesystem.ts` with three operations: read, write, list
- Added sandbox security to filesystem tool restricting access to FILESYSTEM_SANDBOX environment variable directory
- Integrated tool engine into runtime message handlers for CREATE_TOOL, INVOKE_TOOL, TOOL_RESULT messages
- Updated runtime index.ts to initialize tools registry and handle tool-related WebSocket messages
- Fixed tsconfig.json paths for proper shared types resolution
- Built runtime successfully (npm run build passes)
- Committed with message: "Implement Tool Engine + Filesystem tool with sandboxing"
- Pushed to GitHub successfully

## Currently In Progress (if mid-task when session ended)
<!-- Exact file/function you were in the middle of, and what the next concrete step is. -->
None - Tool Engine implementation complete. Next step: Walking skeleton end-to-end verification.

## Needs Human Decision
<!-- Anything ambiguous in the docs that you did NOT guess on. Do not delete entries here until a human resolves them and you log the resolution in the Decision Log below. -->
(none yet)

## Deviations From Spec (should be empty — if not empty, flag loudly to the human)
<!-- If you ever had to deviate from a doc's stated interface, log exactly what and why here, and stop for review. This list should almost always be empty. -->
(none)

## Decision Log Additions Made During Build
<!-- Any new architectural decision made and resolved during implementation gets logged here AND back-ported to the relevant doc's own Decision Log section. -->
- Decided to implement ChatGPT adapter in JavaScript (.js) rather than TypeScript (.ts) to match existing content script pattern in src/content/index.js
- Implemented filesystem tool with sandbox security by default, using FILESYSTEM_SANDBOX env var or ./sandbox fallback

## Test Status
- Unit tests passing: unknown (run them before trusting this)
- Last full walking-skeleton verification: never

## Next Concrete Step
<!-- The single next thing to do, written so specifically that a next session with zero other context could start here. -->
Walking skeleton end-to-end verification: 1) Load extension in Chrome (chrome://extensions → Load unpacked → select extension/src), 2) Start runtime (`cd runtime && npm start`), 3) Click Connect in popup, 4) Open ChatGPT tab, 5) Send prompt requesting file read operation, 6) Verify ToolRequest flows from extension → background → runtime → tool handler → response back → ChatGPT adapter displays result. Document any issues found.
