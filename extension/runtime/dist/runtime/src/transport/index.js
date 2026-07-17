"use strict";
/**
 * Transport Layer - Local WebSocket server with token auth
 * Per Runtime.md: "Exposes a stable protocol so the Extension, and eventually a Desktop app or VS Code plugin, can all drive the same Runtime."
 * Per Security.md: "The local Runtime's endpoint binds to loopback only (127.0.0.1), never 0.0.0.0. The Extension authenticates with a token."
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transport = void 0;
exports.registerCoreHandlers = registerCoreHandlers;
const ws_1 = require("ws");
const uuid_1 = require("uuid");
class Transport {
    wss = null;
    port;
    host;
    storage;
    handlers = new Map();
    connections = new Set();
    constructor(config) {
        this.port = config.port || 8765;
        this.host = config.host || '127.0.0.1';
        this.storage = config.storage;
    }
    /**
     * Register a handler for a specific message type
     */
    on(type, handler) {
        this.handlers.set(type, handler);
    }
    /**
     * Public method to register handlers (alias for on)
     */
    registerHandler(type, handler) {
        this.on(type, handler);
    }
    /**
     * Start the WebSocket server
     */
    start() {
        return new Promise((resolve, reject) => {
            try {
                this.wss = new ws_1.WebSocketServer({
                    host: this.host,
                    port: this.port,
                });
                this.wss.on('listening', () => {
                    console.log(`[Transport] WebSocket server listening on ${this.host}:${this.port}`);
                    resolve();
                });
                this.wss.on('error', (err) => {
                    console.error('[Transport] Server error:', err);
                    reject(err);
                });
                this.wss.on('connection', (ws, req) => {
                    const clientId = (0, uuid_1.v4)();
                    console.log(`[Transport] Client connected: ${clientId} from ${req.socket.remoteAddress}`);
                    this.connections.add(ws);
                    ws.on('message', async (data) => {
                        try {
                            const envelope = JSON.parse(data.toString());
                            await this.handleMessage(envelope, ws);
                        }
                        catch (err) {
                            console.error('[Transport] Error parsing message:', err);
                            this.sendError(ws, 'Invalid message format');
                        }
                    });
                    ws.on('close', () => {
                        console.log(`[Transport] Client disconnected: ${clientId}`);
                        this.connections.delete(ws);
                    });
                    ws.on('error', (err) => {
                        console.error('[Transport] WebSocket error:', err);
                    });
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    /**
     * Handle incoming messages with auth validation
     */
    async handleMessage(envelope, ws) {
        console.log(`[Transport] Received message type: ${envelope.type}`);
        // Auth check for certain message types (skip for initial auth handshake)
        if (envelope.type !== 'AUTH_REQUEST') {
            const authToken = envelope.payload?.authToken;
            if (!authToken || !this.storage.validateAuthToken(authToken)) {
                this.sendError(ws, 'Unauthorized: invalid or missing auth token');
                return;
            }
        }
        const handler = this.handlers.get(envelope.type);
        if (!handler) {
            this.sendError(ws, `Unknown message type: ${envelope.type}`);
            return;
        }
        try {
            await handler(envelope, ws);
        }
        catch (err) {
            console.error(`[Transport] Handler error for ${envelope.type}:`, err);
            this.sendError(ws, `Handler error: ${err.message}`);
        }
    }
    /**
     * Send a message to a specific client
     */
    send(ws, envelope) {
        const fullEnvelope = {
            ...envelope,
            ts: new Date().toISOString(),
        };
        ws.send(JSON.stringify(fullEnvelope));
    }
    /**
     * Broadcast a message to all connected clients
     */
    broadcast(envelope) {
        const data = JSON.stringify({
            ...envelope,
            ts: new Date().toISOString(),
        });
        for (const ws of this.connections) {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(data);
            }
        }
    }
    /**
     * Send an error response
     */
    sendError(ws, message) {
        this.send(ws, {
            type: 'ERROR',
            id: (0, uuid_1.v4)(),
            taskId: null,
            payload: { message },
        });
    }
    /**
     * Public error sender for handlers
     */
    sendErrorPublic(ws, message) {
        this.sendError(ws, message);
    }
    /**
     * Stop the WebSocket server
     */
    stop() {
        return new Promise((resolve) => {
            if (!this.wss) {
                resolve();
                return;
            }
            this.wss.close(() => {
                console.log('[Transport] WebSocket server stopped');
                resolve();
            });
            // Force close all connections
            for (const ws of this.connections) {
                ws.terminate();
            }
            this.connections.clear();
        });
    }
}
exports.Transport = Transport;
/**
 * Built-in message handlers for core Runtime operations
 */
function registerCoreHandlers(transport, storage) {
    // ============================================================================
    // AUTH_REQUEST - Initial authentication to get a token
    // ============================================================================
    transport.on('AUTH_REQUEST', async (envelope, ws) => {
        const { workspaceId } = envelope.payload;
        const token = storage.createAuthToken(workspaceId);
        transport.send(ws, {
            type: 'AUTH_RESPONSE',
            id: envelope.id,
            taskId: null,
            payload: { token, success: true },
        });
    });
    // ============================================================================
    // CREATE_WORKSPACE
    // ============================================================================
    transport.on('CREATE_WORKSPACE', async (envelope, ws) => {
        const { name, projectPath } = envelope.payload;
        const workspace = storage.createWorkspace(name, projectPath);
        transport.send(ws, {
            type: 'WORKSPACE_CREATED',
            id: envelope.id,
            taskId: null,
            payload: { workspace },
        });
    });
    // ============================================================================
    // GET_WORKSPACE
    // ============================================================================
    transport.on('GET_WORKSPACE', async (envelope, ws) => {
        const { workspaceId } = envelope.payload;
        try {
            const workspace = storage.getWorkspace(workspaceId);
            transport.send(ws, {
                type: 'WORKSPACE_INFO',
                id: envelope.id,
                taskId: null,
                payload: { workspace },
            });
        }
        catch (err) {
            transport.sendErrorPublic(ws, err.message);
        }
    });
    // ============================================================================
    // SWITCH_WORKSPACE
    // ============================================================================
    transport.on('SWITCH_WORKSPACE', async (envelope, ws) => {
        const { workspaceId } = envelope.payload;
        storage.switchWorkspace(workspaceId);
        transport.send(ws, {
            type: 'WORKSPACE_SWITCHED',
            id: envelope.id,
            taskId: null,
            payload: { workspaceId },
        });
    });
    // ============================================================================
    // CONNECT_TAB
    // ============================================================================
    transport.on('CONNECT_TAB', async (envelope, ws) => {
        const { workspaceId, tabId, providerId, agentMode } = envelope.payload;
        storage.connectTab(workspaceId, tabId, providerId, agentMode);
        transport.send(ws, {
            type: 'TAB_CONNECTED',
            id: envelope.id,
            taskId: null,
            payload: { workspaceId, tabId, providerId, agentMode: agentMode || 'manual' },
        });
    });
    // ============================================================================
    // DISCONNECT_TAB
    // ============================================================================
    transport.on('DISCONNECT_TAB', async (envelope, ws) => {
        const { workspaceId, tabId } = envelope.payload;
        storage.disconnectTab(workspaceId, tabId);
        transport.send(ws, {
            type: 'TAB_DISCONNECTED',
            id: envelope.id,
            taskId: null,
            payload: { workspaceId, tabId },
        });
    });
    // ============================================================================
    // SET_AGENT_MODE
    // ============================================================================
    transport.on('SET_AGENT_MODE', async (envelope, ws) => {
        const { workspaceId, tabId, mode } = envelope.payload;
        storage.setAgentMode(workspaceId, tabId, mode);
        transport.send(ws, {
            type: 'AGENT_MODE_SET',
            id: envelope.id,
            taskId: null,
            payload: { workspaceId, tabId, mode },
        });
    });
    // ============================================================================
    // SET_PERMISSION
    // ============================================================================
    transport.on('SET_PERMISSION', async (envelope, ws) => {
        const { workspaceId, tool, state } = envelope.payload;
        storage.setPermission(workspaceId, tool, state);
        transport.send(ws, {
            type: 'PERMISSION_SET',
            id: envelope.id,
            taskId: null,
            payload: { workspaceId, tool, state },
        });
    });
    // ============================================================================
    // GET_PERMISSION
    // ============================================================================
    transport.on('GET_PERMISSION', async (envelope, ws) => {
        const { workspaceId, tool } = envelope.payload;
        const state = storage.getPermission(workspaceId, tool);
        transport.send(ws, {
            type: 'PERMISSION_INFO',
            id: envelope.id,
            taskId: null,
            payload: { workspaceId, tool, state },
        });
    });
    // ============================================================================
    // CREATE_TASK
    // ============================================================================
    transport.on('CREATE_TASK', async (envelope, ws) => {
        const { workspaceId, prompt } = envelope.payload;
        const task = storage.createTask(workspaceId, prompt);
        transport.send(ws, {
            type: 'TASK_CREATED',
            id: envelope.id,
            taskId: task.id,
            payload: { task },
        });
    });
    // ============================================================================
    // GET_TASK
    // ============================================================================
    transport.on('GET_TASK', async (envelope, ws) => {
        const { taskId } = envelope.payload;
        try {
            const task = storage.getTask(taskId);
            transport.send(ws, {
                type: 'TASK_INFO',
                id: envelope.id,
                taskId: task.id,
                payload: { task },
            });
        }
        catch (err) {
            transport.sendErrorPublic(ws, err.message);
        }
    });
    // ============================================================================
    // UPDATE_TASK_STATUS
    // ============================================================================
    transport.on('UPDATE_TASK_STATUS', async (envelope, ws) => {
        const { taskId, status, step } = envelope.payload;
        const task = storage.updateTaskStatus(taskId, status, step);
        transport.send(ws, {
            type: 'TASK_UPDATED',
            id: envelope.id,
            taskId: task.id,
            payload: { task },
        });
    });
    // ============================================================================
    // CREATE_SESSION
    // ============================================================================
    transport.on('CREATE_SESSION', async (envelope, ws) => {
        const { role, tabId, providerId } = envelope.payload;
        const session = storage.createSession(role, tabId, providerId);
        transport.send(ws, {
            type: 'SESSION_CREATED',
            id: envelope.id,
            taskId: null,
            payload: { session },
        });
    });
    // ============================================================================
    // GET_SESSION
    // ============================================================================
    transport.on('GET_SESSION', async (envelope, ws) => {
        const { sessionId } = envelope.payload;
        try {
            const session = storage.getSession(sessionId);
            transport.send(ws, {
                type: 'SESSION_INFO',
                id: envelope.id,
                taskId: null,
                payload: { session },
            });
        }
        catch (err) {
            transport.sendErrorPublic(ws, err.message);
        }
    });
    // ============================================================================
    // UPDATE_SESSION_STATUS
    // ============================================================================
    transport.on('UPDATE_SESSION_STATUS', async (envelope, ws) => {
        const { sessionId, status } = envelope.payload;
        const session = storage.updateSessionStatus(sessionId, status);
        transport.send(ws, {
            type: 'SESSION_UPDATED',
            id: envelope.id,
            taskId: null,
            payload: { session },
        });
    });
    // ============================================================================
    // PING/PONG health check
    // ============================================================================
    transport.on('PING', async (envelope, ws) => {
        transport.send(ws, {
            type: 'PONG',
            id: envelope.id,
            taskId: null,
            payload: { timestamp: new Date().toISOString() },
        });
    });
    // ============================================================================
    // RELAY_TO_ADAPTER - Forward instruction to specific tab's adapter
    // ============================================================================
    transport.on('RELAY_TO_ADAPTER', async (envelope, ws) => {
        const { tabId, instruction } = envelope.payload;
        console.log(`[Transport] RELAY_TO_ADAPTER: Forwarding instruction to tab ${tabId}`);
        // Send message to extension background to relay to content script
        // This requires the extension to be connected and listening
        transport.send(ws, {
            type: 'RELAY_TO_ADAPTER',
            id: envelope.id,
            taskId: null,
            payload: { tabId, instruction },
        });
    });
}
exports.default = Transport;
//# sourceMappingURL=index.js.map