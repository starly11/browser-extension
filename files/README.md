# AIOS — Local AI Runtime Specification

A browser-agnostic runtime that turns web-based AI assistants into secure, autonomous local agents.

This repository is the **specification**, not the implementation. Every document here is a contract. Code should only be written once the relevant contract is stable — see `Design Principles.md`, principle #3 and #9.

## How to use this with a coding model
When directing Qwen Coder, Claude Code, GPT, or any other model to implement a piece of AIOS, always point it at the specific doc(s) governing that piece, and reject any output that invents architecture not found in these docs.

## Status

### Phase A — Product Foundation ✅ done (this batch)
- `00-Vision/Product Vision.md`
- `00-Vision/Design Principles.md`
- `00-Vision/Non Goals.md`
- `00-Vision/Terminology.md`
- `00-Vision/User Experience.md`
- `00-Vision/Personas.md`
- `00-Vision/Goals.md`
- `00-Vision/Success Metrics.md`
- `00-Vision/Competitive Positioning.md`

### Phase B — System Architecture — in progress
- `01-Architecture/Adapter Resilience.md` ✅ (pulled forward — directly answers the DOM-fragility risk)
- Runtime.md, Extension.md, Browser Adapter.md, Planner.md, Worker.md, Task Engine.md, Workspace.md, Session Manager.md, Tool Engine.md, Memory Model.md, Storage.md, Protocol Overview.md, Security.md, Recovery.md, Component Diagrams.md — pending

### Phase C — Contracts (JSON schemas, state machines, permission contracts) — pending
### Phase D — Product UX (every screen, notification, journey) — pending
### Phase E — Engineering Guide (folder structure, standards, testing, CI/CD) — pending

## Review Process
Per the original plan: each document is reviewed and refined until internally consistent before the next one is written. Nothing in a later phase should contradict something frozen in an earlier phase — if it does, that's a signal the earlier doc needs a deliberate, logged revision, not a silent workaround downstream.
