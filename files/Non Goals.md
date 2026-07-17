# Non-Goals

Explicitly defining what AIOS will NOT do prevents scope creep and stops future contributors (human or AI) from "helpfully" adding things that break the architecture.

## AIOS is not an IDE
It does not replace VS Code, Cursor, or any editor. It feeds context to and receives instructions from AI assistants; it does not provide a code-editing surface itself in v1.

## AIOS is not a new AI model
It has no model of its own. It orchestrates whichever AI assistant the user already has open (ChatGPT, Gemini, Claude, etc.) via Reasoning Sessions.

## AIOS does not scrape or store conversation content beyond what's needed for the active task
No training data collection, no analytics on prompt content, no silent logging of full conversations to a remote server.

## AIOS does not auto-execute AI-generated shell commands
There is no path where an LLM's raw text output is passed to `exec()` or `shell=True`. All execution goes through validated, permissioned tools. See Security.md.

## AIOS does not control browser tabs the user hasn't explicitly connected
No background surveillance of arbitrary tabs. No "detect any ChatGPT tab and take it over."

## AIOS does not depend on any single AI provider's DOM structure for its core value
DOM adapters are an implementation detail behind a stable contract (see Adapter Resilience.md). If ChatGPT redesigns its UI, only the adapter changes — never the Planner, Worker, or Tool Protocol.

## AIOS is not a cloud service in v1
Runtime runs locally. No required server-side component. (Cloud sync of workspaces/permissions is a explicitly a *future* extension, not a v1 goal — see Roadmap.)

## AIOS does not try to support every browser and every AI provider on day one
v1 targets Chrome + one or two AI providers (e.g. ChatGPT, Claude) end-to-end, done well, rather than five providers done shakily.

## Decision Log
- Rejected "auto-connect all AI tabs" after reviewing the permission philosophy — opt-in per tab is mandatory.
- Rejected building a full code editor into the extension — out of scope, duplicates existing tools.
