# Personas

## 1. The Solo Full-Stack Developer ("Ali")
- Works across 2-4 side projects, uses ChatGPT/Claude constantly for debugging and explanation.
- Doesn't want to switch to Cursor full-time — has an existing editor workflow and habits.
- Pain: constantly re-pasting file contents, re-explaining project structure every session.
- Wants: the AI to "just know" the project without setup ceremony each time.
- Primary use of AIOS: semantic file attachment, staying inside their existing chat AI.

## 2. The Cautious Engineer ("Reviewer")
- Deeply distrustful of browser extensions with broad permissions.
- Will read the permissions screen before installing anything.
- Pain: most "AI + local files" tools ask for blanket access up front.
- Wants: per-tool, per-tab, explicit, revocable permissions with an obvious "OFF" state.
- Primary use of AIOS: Manual/Assistant modes, permission dashboard, workspace isolation.

## 3. The Team Lead ("Scaling User", future persona)
- Wants consistent tooling across a small team, ideally with shared workspace configs.
- Not a v1 target user but shapes the architecture (workspaces, permissions-as-data) so this is possible later without a rewrite.

## 4. The Coding-Model Operator ("Builder")
- Uses AIOS's own specification documents as the source of truth to direct an LLM (Qwen Coder, Claude Code, GPT) to implement the system.
- Not an end user of the shipped product — a consumer of the *documentation* itself.
- Needs: unambiguous contracts, explicit state machines, and no architecture invented on the fly by the coding model.

## Anti-Persona
- Someone looking for a "set it and forget it, fully autonomous, no prompts" tool that operates without ever asking permission. AIOS explicitly does not target this behavior as a default — Autonomous mode exists, but it is opt-in per workspace, never the out-of-box state.
