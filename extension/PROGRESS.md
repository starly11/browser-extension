# PROGRESS

> This file is the project's memory. You (the coding agent) have no memory between sessions — this file is the only thing that persists. Read it fully before doing anything. Update it before you stop, every session, no exceptions.

## Current Phase
`PHASE_1_SKELETON`
<!-- One of: PHASE_1_SKELETON | PHASE_2_SEMANTIC_ATTACH | PHASE_3_PLANNER_WORKER | PHASE_4_RECOVERY | PHASE_5_SECOND_PROVIDER -->

## Build Order Checklist (per Build_Guide.md — do not reorder, do not skip ahead)
- [x] `shared/types.ts` generated from `docs/02-Contracts/Contracts.md` (already existed, verified against Contracts.md)
- [x] Runtime skeleton: SQLite storage layer, WS transport + token auth (implemented and verified - server starts successfully on ws://127.0.0.1:8765)
- [ ] Extension skeleton: manifest, popup (connect/disconnect only), background relay
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
- Reorganized project structure to separate actual extension code from documentation and supporting files
- Created clean folder structure:
  - `/extension/` - Contains all actual extension code (runtime/, shared/, docs/)
  - `/files/` - Contains supporting files, zips, and other non-code assets
- Moved runtime/, shared/, docs/, AGENT_PROMPT.md, PROGRESS.md into /extension/
- Moved all .md and .zip files from root into /files/
- Removed duplicate "files (1)" directory
- Runtime skeleton is complete with:
  - SQLite storage layer persisting Task, Workspace, ReasoningSession, Permission shapes
  - WebSocket transport server on 127.0.0.1:8765 with token auth
  - Core message handlers for workspace management, task management, session management
  - Graceful shutdown with task interruption marking per Recovery.md
- Verified runtime builds successfully (`npm run build` passes)
- Committed and pushed reorganization changes to GitHub

## Currently In Progress (if mid-task when session ended)
<!-- Exact file/function you were in the middle of, and what the next concrete step is. -->
None - Project reorganization complete. Next step: Extension skeleton (manifest, popup with connect/disconnect, background relay) per Build_Guide.md step 3.

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
<!-- The single next thing to do, written so specifically that a session with zero other context could start here. -->
Implement Extension skeleton: create manifest.json, popup HTML/CSS/JS with connect/disconnect UI only, and background script as relay between popup and runtime WebSocket server. All extension code goes in /extension/ directory.
