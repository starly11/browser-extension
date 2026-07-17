# NORTH STAR — AIOS Vision, Principles, Non-Goals (condensed)

## What AIOS is
A local runtime that turns any web-based AI assistant (ChatGPT, Claude, Gemini, etc.) into a secure, local, autonomous agent — without the user leaving the browser or the AI provider they already use. The browser tab looks and behaves exactly as it always did. Underneath, a local Runtime gives that AI eyes (read files), hands (run tools), and memory (persistent task state), governed by a strict, inspectable permission model.

The core insight: the pain isn't "AI can't read my files" — it's "I want to stay inside the AI I already use, but give it the same local superpowers Cursor has."

## What AIOS is not
- Not an IDE — doesn't replace VS Code or Cursor.
- Not a new AI model — orchestrates whichever assistant the user already has open.
- Not a conversation-scraping or analytics product.
- Not a system that auto-executes AI-generated shell commands, ever.
- Not a system that controls any browser tab the user hasn't explicitly connected.
- Not dependent on any single provider's DOM for its core value — adapters are swappable, everything above them is stable.
- Not a cloud service in v1 — fully local, no required server component.
- Not trying to support every browser/provider on day one — v1 is one browser, one or two providers, done well.

## Design Principles (law — every decision is checked against these)
1. **The Runtime is the source of truth. Browser AI sessions are disposable reasoning engines.** Nothing important lives in a tab; a crash loses nothing.
2. **The extension is dumb by design.** Connects/disconnects tabs, relays messages, invokes adapters. Never plans, never decides, never holds state beyond the current message.
3. **Contracts are frozen; implementations are disposable.** Interfaces almost never change; what's behind them can change weekly.
4. **Nothing is automatic until the user says so.** No tab controlled, no tool run, no task started without explicit opt-in.
5. **AI never executes anything directly.** It can only request a tool; the Runtime validates and executes.
6. **Every capability is a tool, not a hardcoded behavior.** New capability = new tool registration, not a core change.
7. **Failure is a first-class state, not an exception.** Every state machine has explicit failure/recovery states.
8. **The user should be able to forget the extension exists.** Once set up, the AI chat looks normal; nothing bolted onto the visible UI uninvited.
9. **Vision, Runtime, and Developer concerns are documented separately** — never mixed in one doc.
10. **Degrade gracefully, never fail silently.** Missing element, missing permission, disconnected tab → drop to a safer state and tell the user.

## v1 Goals (must be true at first ship)
1. Install → select project folder → connect one tab, under 2 minutes, zero config screens.
2. A natural-language request results in automatically-attached relevant files — no manual selection.
3. No tool executes without a visible, explicit permission grant.
4. Disconnecting a tab / Agent Mode OFF immediately and verifiably stops all automation for that tab.
5. A provider UI change only requires replacing its adapter — Planner, Worker, Tool Protocol, Runtime core untouched.
6. Task state survives a browser crash — resumed or clearly marked abandoned, never silently lost.
7. A coding model can implement each module from its spec doc alone, without needing architecture clarification.

## Decision Log
- Runtime, not the browser, is the source of truth.
- No auto-generated shell execution from AI output, ever.
- No tab is controlled without explicit user connection.
