// LocalContext Protocol — API contract between extension and runtime
// Reference document — not loaded at runtime. Match lc-runtime/src/types.ts.

// === WebSocket (ws://localhost:3333/ws) ===
//
// Extension → Runtime:
//   { type: "tool_request", payload: ToolRequest }
//   { type: "ping", payload: {} }
//
// Runtime → Extension:
//   { type: "tool_response", payload: ToolResponse }
//   { type: "pong", payload: {} }
//   { type: "error", payload: { error: string } }

// ToolRequest:
//   { id: string, tool: string, args: Record<string, unknown>, taskId?: string }

// ToolResponse:
//   { id: string, success: boolean, output: string,
//     data?: Record<string, unknown>, error?: string, durationMs: number }

// === REST API (http://localhost:3333) ===
//
// GET  /api/health              → { status: "ok", uptime: number, tools: string[] }
// GET  /api/tools               → { tools: ToolDefinition[] }
// GET  /api/tools/:name         → ToolDefinition
// POST /api/tools/:name         → ToolResponse
//   Body: { args?: {}, id?: string, taskId?: string }

// === Available Tools (M1) ===
//
// get_os  — OS info via os module (platform, release, arch, hostname, memory, CPUs)
// pwd     — Current working directory via process.cwd()
// whoami  — User info via os.userInfo() (username, UID, GID, home, shell)

// === Content Script ↔ Background (chrome.runtime.sendMessage) ===
//
// Content → Background:
//   { type: "content_ready", platform: string }
//   { type: "user_message", source: "worker"|"planner", platform, payload: { text, message_index } }
//   { type: "run_tool", tool: string, args: {}, task_id?: string }
//   { type: "run_tool_rest", tool: string, args: {}, task_id?: string }  // REST fallback
//   { type: "get_status" }
//
// Background → Content:
//   { type: "inject_response", payload: { text: string } }
//   { type: "tool_result", payload: ToolResponse }
//   { type: "runtime_error", payload: { error: string } }
//   { type: "runtime_status", status: "connected"|"disconnected" }
