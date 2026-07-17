# Adapter Resilience (Phase B Preview)

## Purpose
Define exactly how AIOS survives web UI redesigns without breaking, and without silently misbehaving in the meantime. This document exists early, out of phase order, because it is the direct answer to the single biggest risk in the whole product: DOM fragility.

## Problem
Every adapter (ChatGPT, Gemini, Claude) depends on reading and writing another company's web page. That page will change without notice. A naive extension breaks on every redesign and turns "ship features" into "fix selectors."

## Design Rules

### 1. Adapters are versioned artifacts, not living code that gets patched in place
Each adapter ships as `provider-adapter@X.Y.Z`. The Runtime pins a known-good version per provider. When a provider changes its UI, a *new* adapter version is published — the old one is never silently mutated. This makes every behavior change auditable and revertible.

### 2. Every element lookup uses a strategy chain, not a single selector
For each required element (message input, send control, response container, "generation complete" signal), the adapter tries strategies in this fixed priority order:
1. Accessibility tree / ARIA role + label (most stable — providers rarely break accessibility without noticing).
2. Stable structural attributes, if the provider exposes any (e.g. `data-testid`-style hooks).
3. Positional/structural heuristics (e.g. "the last empty contenteditable inside the main chat column") as a fallback.
4. If all strategies fail: do not guess. Report failure to the Runtime.

### 3. Continuous self-testing, not one-time detection
Before automating any action, and periodically during a long session, the adapter runs a lightweight health check: can it currently locate the required elements? This is not a one-time "detect on load" check — providers can change layout via client-side routing without a full page reload.

### 4. Failure degrades the tab, not the system
If a health check fails:
- That specific tab is marked **Degraded** in the Session Manager.
- Agent Mode for that tab automatically drops toward Manual (never toward more automation).
- The user is shown a plain-language notice: *"Couldn't find the message box on this page — switched to manual mode."*
- No other connected tab, no other provider, and no Runtime state is affected.

### 5. The contract above the adapter never changes because of a UI redesign
Planner, Worker, Task Engine, and Tool Protocol only ever call the fixed adapter interface (`detect()`, `newChat()`, `sendPrompt()`, `attachFiles()`, `waitUntilFinished()`, `readResponse()`, `stopGeneration()`, `rotate()`, `healthCheck()`). A redesign changes what happens *inside* `sendPrompt()` for that one provider — never its signature, never anything above it.

### 6. Adapters fail closed on writes, fail open on reads
If the adapter is uncertain whether a message actually sent (ambiguous state), it never silently retries a send (which could double-submit). It reports "uncertain" and asks the Runtime to surface this to the user, rather than guessing.

## Failure Cases & Recovery
| Failure | Detection | Recovery |
|---|---|---|
| Provider changes input field structure | Health check strategy chain exhausted | Tab → Degraded → Manual mode, user notified |
| Provider changes response-complete signal | `waitUntilFinished()` times out repeatedly | Task marked "response uncertain," user shown raw tab to confirm manually |
| Provider ships a client-side-only layout change mid-session | Periodic health check during long task | Same as above — no full reload assumed |
| Adapter version mismatch with Runtime expectations | Adapter reports its own version at `detect()` | Runtime refuses to run automation with an untested version pairing, falls back to Manual |

## Decision Log
- Rejected relying on a single CSS selector per element — too brittle given real-world redesign frequency.
- Rejected "auto-retry send on uncertainty" — risk of double-submission outweighs convenience.
- Decided health checks run continuously, not just at tab-connect time, after considering client-side-routed UI changes.
