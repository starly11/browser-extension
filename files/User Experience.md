# User Experience

## Purpose
Describe the end-to-end experience from the user's point of view, with zero implementation language. If a sentence in this document mentions SQLite, Planner, or JSON, it doesn't belong here.

## First Launch
1. User installs the extension.
2. A small popup appears: Runtime status (Connected), current AI tab, project (Not selected).
3. User clicks **Select Project** and picks a local folder.
4. Done. No settings screen, no onboarding wizard, no configuration wall.

## Everyday Use
1. User opens ChatGPT (or whichever AI they use). It looks completely normal.
2. Nothing is connected by default. The user explicitly clicks **Connect Current Tab** when they want this tab to participate.
3. User types a question naturally: *"Explain how authentication works in this project."*
4. For a brief moment (a notification like "Attaching 4 files…" may appear top-right), the system gathers relevant files automatically.
5. The AI's answer arrives as normal — just far better informed, with the right files already in context.
6. The user never manually attaches a file, never explains project structure, never sees an error about "planner" or "worker."

## Visibility Without Clutter
- **Popup**: runtime status, current project, connected tabs, Planner/Worker idle-or-busy state. Nothing more.
- **Task Drawer** (optional, click to expand): a GitHub-Actions-style checklist — "Read package.json ✓, Read auth.ts ✓, Attached files ✓, Waiting for AI…"
- **Notifications**: small, top-right, auto-dismissing (e.g. "Attaching 4 files…").
- **Logs**: hidden by default, available for developers only.

## Trust Moments
- The badge color tells the user the automation state at a glance: grey = off, blue = manual, green = autonomous.
- Before any tool with an "Ask Every Time" permission runs, the user sees a concrete approval prompt ("Read auth.ts?") — never a vague "AI wants to do something."
- Switching projects visibly switches workspaces: old tabs disconnect, new permissions and tabs activate. Nothing carries over silently.

## Failure Experience
- If a browser tab's layout has changed and the adapter can't safely operate it, the tab visibly drops to Manual mode with a clear, plain-language reason ("Couldn't find the message box on this page — falling back to manual"). The user is never left wondering why something silently stopped working.

## What Success Feels Like
The user forgets AIOS exists most of the time. They just notice that their AI assistant "gets it" — understands their project, runs the commands they'd have run themselves, and never surprises them with an unapproved action.
