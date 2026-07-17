# Browser Adapter

## Purpose
Define the single fixed interface every AI-provider adapter must implement, so the rest of AIOS never needs to know which provider it's talking to.

## Problem
Each AI provider's web UI is different, undocumented, and prone to change. Without a strict interface boundary, provider-specific logic leaks upward into the Runtime and becomes impossible to maintain across providers.

## Goals
- One interface, implemented once per provider.
- Everything provider-specific stays inside the adapter; nothing above it needs to change when a provider updates their UI (see `Adapter Resilience.md` for how the adapter itself survives such updates).

## Non-Goals
- Adapters do not decide *what* to send or *why* — that's the Planner/Worker's job via the Task Engine. Adapters only know *how* to operate a given provider's page.
- Adapters do not persist state across page reloads themselves; durable state lives in the Runtime.

## Required Interface
Every adapter must implement:
```
detect(): { supported: bool, providerId, version }
newChat(): ChatHandle
sendPrompt(chatHandle, text): void
attachFiles(chatHandle, files[]): void
waitUntilFinished(chatHandle): Response
readResponse(chatHandle): Response
stopGeneration(chatHandle): void
rotate(chatHandle): ChatHandle   // start fresh chat, per Chat Rotation.md
healthCheck(): { ok: bool, reason? }
```
If a provider cannot support one of these (e.g. no way to programmatically stop generation), that limitation is declared explicitly in the adapter's manifest — never silently skipped.

## Responsibilities
1. Translate the fixed interface calls into actual DOM operations on the provider's page.
2. Run `healthCheck()` proactively and honestly — see `Adapter Resilience.md` for the strategy chain and failure handling.
3. Report a version identifier at `detect()` so the Runtime can pin known-good adapter/provider version pairs.
4. Never guess on ambiguous states (e.g. "did the message send?") — report uncertainty rather than assume success.

## Data Model
- `ChatHandle { tabId, chatId, providerId }`
- `Response { text, attachments[], status(complete|uncertain|error) }`
- `AdapterManifest { providerId, version, supportedCapabilities[], unsupportedCapabilities[] }`

## Failure Cases & Recovery
See `Adapter Resilience.md` for the full strategy chain and degrade-to-Manual behavior. Summary: adapters fail closed on writes (never double-send), fail open on reads (report "uncertain" rather than fabricate a response), and always prefer reporting failure over guessing.

## Future Extension
- New providers are added by writing a new adapter against this exact interface — no changes to Planner, Worker, Task Engine, or Runtime core required.
- Firefox/Edge support reuses the same adapters; only the Extension's browser-API glue layer differs.

## Decision Log
- Decided `stopGeneration` and `rotate` are part of the required interface from day one, even though not every early provider needs them, so later providers don't force an interface-breaking change.
