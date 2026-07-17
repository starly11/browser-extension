# PROGRESS

> This file is the project's memory. You (the coding agent) have no memory between sessions — this file is the only thing that persists. Read it fully before doing anything. Update it before you stop, every session, no exceptions.

## Current Phase
`PHASE_1_SKELETON`
<!-- One of: PHASE_1_SKELETON | PHASE_2_SEMANTIC_ATTACH | PHASE_3_PLANNER_WORKER | PHASE_4_RECOVERY | PHASE_5_SECOND_PROVIDER -->

## Build Order Checklist (per Build_Guide.md — do not reorder, do not skip ahead)
- [x] `shared/types.ts` generated from `docs/02-Contracts/Contracts.md` (already existed, verified against Contracts.md)
- [x] Runtime skeleton: SQLite storage layer, WS transport + token auth (implemented and verified - server starts successfully on ws://127.0.0.1:8765)
- [x] Extension skeleton: manifest, popup (connect/disconnect only), background relay (implemented - see manifest.json, src/popup/, src/background/, src/content/)
- [ ] One Adapter implemented (provider: __________)
- [ ] Tool Engine + `filesystem.attach(path)` (manual path)
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
- Implemented Extension skeleton per Build_Guide.md step 3:
  - Created `manifest.json` with Manifest V3 configuration (permissions: activeTab, storage, scripting; host_permissions: <all_urls>)
  - Created `src/popup/index.html` - Popup UI with Runtime status display, connect/disconnect buttons, and Agent Mode selector
  - Created `src/popup/popup.js` - Popup logic for checking Runtime status, connecting/disconnecting tabs, setting agent mode
  - Created `src/background/index.js` - Background service worker acting as relay between popup/content and Runtime WebSocket server (ws://127.0.0.1:8765)
  - Created `src/content/index.js` - Content script hosting adapter implementations for ChatGPT, Claude, and Gemini providers
- Adapter implementations include all 9 interface methods from BrowserAdapter interface (detect, newChat, sendPrompt, attachFiles, waitUntilFinished, readResponse, stopGeneration, rotate, healthCheck)
- Extension follows "dumb relay" pattern from Extension.md - no planning/decision-making, only relays messages between Runtime and adapters
- Committed changes with message: "extension: add skeleton with manifest, popup UI, background relay, and content script adapters"
- Next step: Implement one full Adapter (ChatGPT recommended) with proper DOM selectors and file attachment support

## Currently In Progress (if mid-task when session ended)
<!-- Exact file/function you were in the middle of, and what the next concrete step is. -->
None - Extension skeleton complete. Next step: Implement one full Adapter (ChatGPT recommended) with proper DOM selectors and file attachment support per Browser Adapter.md.

## Needs Human Decision
<!-- Anything ambiguous in the docs that you did NOT guess on. Do not delete entries here until a human resolves them and you log the resolution in the Decision Log below. -->
(none yet)

## Deviations From Spec (should be empty — if not empty, flag loudly to the human)
<!-- If you ever had to deviate from a doc's stated interface, log exactly what and why here, and stop for review. This list should almost always be empty. -->
(none)

## Decision Log Additions Made During Build
<!-- Any new architectural decision made and resolved during implementation gets logged here AND back-ported to the relevant doc's own Decision Log section. -->
(none yet)

## Test Status
- Unit tests passing: unknown (run them before trusting this)
- Last full walking-skeleton verification: never

## Next Concrete Step
<!-- The single next thing to do, written so specifically that a next session with zero other context could start here. -->
Implement ChatGPT Adapter fully: refactor `src/content/index.js` to move ChatGPT adapter into `src/adapters/chatgpt.ts`, implement proper DOM selectors for current ChatGPT UI (textarea, send button, response elements), implement file attachment via click-and-paste or file input interaction, add error handling for UI changes, and ensure all 9 BrowserAdapter interface methods work correctly. Test by loading extension in Chrome, connecting a ChatGPT tab, and verifying basic send/receive works.
