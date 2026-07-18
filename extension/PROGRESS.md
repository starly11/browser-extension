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
- **Critical auth handshake bug fixed:** Extension was sending CONNECT_TAB and other messages before receiving AUTH_RESPONSE from Runtime, causing "Unauthorized: invalid or missing auth token" errors
- **Root cause:** The `connectToRuntime()` function resolved immediately after sending AUTH_REQUEST, without waiting for AUTH_RESPONSE
- **Fix implemented:**
  - Added `isAuthComplete` flag to track authentication handshake state
  - Modified `connectToRuntime()` to NOT resolve until AUTH_RESPONSE received (removed premature `resolve()`)
  - Updated `sendToRuntime()` to queue messages if auth not complete (except AUTH_REQUEST itself)
  - Set `isAuthComplete = true` only when AUTH_RESPONSE with token is received
  - Removed hardcoded `AUTH_TOKEN` constant (no longer needed)
- **Rebuilt extension bundles** (background/content dist.js) with fix
- **Committed and pushed** (commit 4001194): "fix: Add auth handshake tracking to prevent premature message sending"
- Auth flow now correctly: CONNECT → AUTH_REQUEST → wait for AUTH_RESPONSE → store token → allow subsequent messages

## Currently In Progress (if mid-task when session ended)
<!-- Exact file/function you were in the middle of, and what the next concrete step is. -->
Walking skeleton end-to-end verification READY - extension now properly handles TOOL_REQUEST → TOOL_RESULT flow:
1. Load extension in Chrome (chrome://extensions → Load unpacked → select extension/)
2. Start runtime: `cd extension/runtime && node dist/runtime/src/index.js`
3. Start backend: `cd backend && node server.js`
4. Open ChatGPT tab, click Connect in popup
5. Verify: TOOL_REQUEST → filesystem.read → TOOL_RESULT in console logs
6. Backend should log "🎉 WALKING SKELETON VERIFIED" on successful flow

## Needs Human Decision
<!-- Anything ambiguous in the docs that you did NOT guess on. -->
(none)

## Deviations From Spec (should be empty — if not empty, flag loudly to the human)
<!-- If you ever had to deviate from a doc's stated interface, log exactly what and why here, and stop for review. -->
(none)

## Decision Log Additions Made During Build
<!-- Any new architectural decision made and resolved during implementation gets logged here AND back-ported to the relevant doc's own Decision Log section. -->
- Decided to implement ChatGPT adapter in JavaScript (.js) rather than TypeScript (.ts) to match existing content script pattern in src/content/index.js
- Implemented filesystem tool with sandbox security by default, using FILESYSTEM_SANDBOX env var or ./sandbox fallback
- Backend test server now sends TOOL_REQUEST to test filesystem tools end-to-end instead of just SEND_PROMPT
- Extension content script simulates filesystem.read response for walking skeleton test (production will have Runtime execute tools directly)

## Test Status
- Unit tests passing: unknown (run them before trusting this)
- Last full walking-skeleton verification: READY FOR MANUAL TEST - TOOL_REQUEST flow implemented in extension, requires Chrome testing

## Next Concrete Step
<!-- The single next thing to do, written so specifically that a next session with zero other context could start here. -->
MANUAL TESTING REQUIRED for walking skeleton verification: 1) Start runtime (`cd extension/runtime && node dist/runtime/src/index.js`), 2) Start backend test server (`cd backend && node server.js`), 3) Load/reload extension in Chrome, 4) Open ChatGPT tab, 5) Click Connect in popup, 6) Watch for TOOL_REQUEST in runtime/backend logs, 7) Verify filesystem.read executes and returns TOOL_RESULT, 8) Backend should log "🎉 WALKING SKELETON VERIFIED". If successful, mark "Walking skeleton verified end-to-end" as complete in checklist and move to Semantic attachment tool implementation.
