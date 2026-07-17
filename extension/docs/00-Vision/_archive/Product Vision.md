# Product Vision

## Purpose
Define what AIOS is, why it exists, and what future it is building toward.

## Problem
Millions of developers use web-based AI assistants (ChatGPT, Gemini, Claude, Grok, DeepSeek, Perplexity, Qwen) but none of these assistants have access to the user's local machine. Tools like Cursor solved this by owning the whole IDE. That forces a full editor switch, which most developers won't make just to get local context.

The result: developers manually copy-paste files, describe project structure in prose, and re-explain context every session. The AI is smart. It is just blind.

## Vision Statement
**AIOS turns any web-based AI assistant into a secure, local, autonomous agent — without the user ever leaving the browser or the AI provider they already use.**

The browser tab stays exactly what it looks like today. Underneath it, a local runtime gives that AI eyes (read files), hands (run tools), and memory (persistent task state) — governed by a strict, inspectable permission model.

## The Core Insight
The pain isn't "AI can't read my files." The pain is:
> "I want to stay inside ChatGPT/Gemini/Claude, but give them the same superpowers Cursor has."

## What AIOS Is
- A **local runtime** that owns tasks, tool execution, state, and security.
- A **thin browser extension** that only connects/disconnects tabs and relays messages — it does not think.
- A **stable tool protocol** (filesystem, terminal, git, docker, browser, MCP servers) that any AI provider can be pointed at.
- A **permission and workspace model** that makes automation opt-in, visible, and revocable at all times.

## What AIOS Is Not
See `Non Goals.md` for the explicit list. In short: AIOS is not an IDE, not a new AI model, not a DOM-scraping automation script, and not an always-on background spy.

## Long-Term Direction
1. Browser extension (Chrome/Firefox/Edge) as the first interface.
2. Desktop app and VS Code plugin using the exact same runtime.
3. Runtime becomes provider-agnostic: any LLM (local or hosted) can be plugged in as a "reasoning session."
4. Workspaces become shareable: team workspaces, cloud-synced permissions, task history as a real audit trail.

## Decision Log
- Decided the runtime, not the browser, is the source of truth (see System Architecture.md).
- Decided against auto-generated shell execution from AI output (see Security.md).
- Decided the extension must never control a tab the user hasn't explicitly connected (see Permissions.md).
