# Build Guide

## Purpose
The one page that tells any coding agent (Qwen, Claude Code, GPT) where code lives, what language to use, and how to treat the spec docs while implementing.

## Language decision
**TypeScript, everywhere possible.** The Extension must be JS/TS (Manifest V3 requirement). Making the Runtime Node/TypeScript too means `Contracts.md`'s shapes can become one set of shared TS types (`shared/types.ts`), imported by both Runtime and Extension — no shape drifts between them. SQLite via `better-sqlite3` or equivalent. Python is fine for one-off scripts (e.g. the semantic-attach grep/graph logic) invoked as a subprocess by a tool handler, but the Runtime process itself is Node.

## Repository layout
```
AIOS/
  docs/                        <- frozen spec, read-only during implementation
    00-Vision/NORTH_STAR.md
    01-Architecture/*.md
    02-Contracts/Contracts.md
    03-Build/Build_Guide.md
  PROGRESS.md                  <- living state, updated every session (see below)
  shared/
    types.ts                   <- TS types generated from Contracts.md, imported by both runtime/ and extension/
  runtime/
    src/
      taskEngine/
      toolEngine/
        tools/
          filesystem.ts
          terminal.ts
          git.ts
      sessionManager/
      workspace/
      storage/                 <- SQLite access layer
      security/                <- permission checks, path confinement, allowlists
      transport/                <- local WebSocket server + auth token
      recovery/
      index.ts
    test/
  extension/
    manifest.json
    src/
      background/               <- extension.md's "relay" responsibilities only
      popup/
      adapters/
        base.ts                 <- the fixed interface from Contracts.md, as a TS interface
        chatgpt.ts
        claude.ts
    test/
```

## Coding standards
- Every module's public interface must match its `.md` doc's Interface section **exactly** — same method names, same parameter order. If you (the coding agent) believe the interface should change, stop and propose the change as a diff to the doc first; do not silently implement something different.
- No `any` types at module boundaries — use the shapes in `shared/types.ts`.
- No tool handler ever builds a shell string. See `Security.md` — command + args array only.
- Every ToolResult, every state transition, gets logged to the Task's `steps[]` — not just to console.
- Tests: each tool handler gets a unit test with a mocked filesystem/process; each Adapter gets a contract test asserting it implements all nine interface methods (even if some throw "unsupported" deliberately — that must be explicit, per `Browser Adapter.md`).

## How to hand this to a coding agent
1. Give it `docs/00-Vision/NORTH_STAR.md`, the specific architecture doc(s) for the module being built, and `Contracts.md`. Never ask it to implement from a partial reading.
2. Tell it explicitly: "Implement only what these documents specify. Do not add methods, state, or files not implied by the docs. If something is ambiguous, write the ambiguity into PROGRESS.md under 'Needs Human Decision' rather than guessing."
3. After it produces code, check the diff against the doc's Interface section line by line before accepting.
4. Small commits. One module or one clearly-scoped piece of a module per commit. Commit message references which doc it implements, e.g. `git commit -m "runtime: tool engine registry per Tool_Engine.md"`.

## Build order (do not reorder)
1. `shared/types.ts` from Contracts.md.
2. Runtime skeleton: storage (SQLite tables mirroring Workspace/Task/Permission), transport (WS server + token auth), no tools yet.
3. Extension skeleton: manifest, popup with connect/disconnect only, background relay, one Adapter (pick one provider).
4. Tool Engine + exactly one tool: `filesystem.attach(path)`, manual path only.
5. End-to-end check: typing a path in the popup gets that file's content into the connected tab. This is the walking skeleton — nothing else matters until this works.
6. Semantic attachment (grep + import graph + git blame → auto-selected files) as a second tool.
7. Task Engine + Planner/Worker split + permission gate (Ask/Allowed/Denied) + iteration guard.
8. Recovery (crash → Interrupted state, per Contracts.md state machine).
9. Second Adapter, Agent Mode, chat rotation — post-v1.

## Decision Log
- Decided TypeScript for both Runtime and Extension specifically so `shared/types.ts` can be the literal, importable, compiler-enforced version of Contracts.md — not just a shared convention two separately-typed codebases try to honor.
