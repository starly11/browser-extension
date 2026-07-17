/**
 * Transport Layer - Local WebSocket server with token auth
 * Per Runtime.md: "Exposes a stable protocol so the Extension, and eventually a Desktop app or VS Code plugin, can all drive the same Runtime."
 * Per Security.md: "The local Runtime's endpoint binds to loopback only (127.0.0.1), never 0.0.0.0. The Extension authenticates with a token."
 */

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '../storage';
import { TransportEnvelope, TaskStatus, PermissionState } from '@shared/types';

export interface TransportConfig {
  port?: number; // defaults to 8765
  host?: string; // defaults to '127.0.0.1'
  storage: Storage;
}

type MessageHandler = (envelope: TransportEnvelope, ws: WebSocket) => Promise<void>;

export class Transport {
  private wss: WebSocketServer | null = null;
  private port: number;
  private host: string;
  private storage: Storage;
  private handlers: Map<string, MessageHandler> = new Map();
  private connections: Set<WebSocket> = new Set();

  constructor(config: TransportConfig) {
    this.port = config.port || 8765;
    this.host = config.host || '127.0.0.1';
    this.storage = config.storage;
  }

  /**
   * Register a handler for a specific message type
   */
  on(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Public method to register handlers (alias for on)
   */
  registerHandler(type: string, handler: MessageHandler): void {
    this.on(type, handler);
  }

  /**
   * Start the WebSocket server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
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
          const clientId = uuidv4();
          console.log(`[Transport] Client connected: ${clientId} from ${req.socket.remoteAddress}`);
          this.connections.add(ws);

          ws.on('message', async (data) => {
            try {
              const envelope: TransportEnvelope = JSON.parse(data.toString());
              await this.handleMessage(envelope, ws);
            } catch (err) {
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
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Handle incoming messages with auth validation
   */
  private async handleMessage(envelope: TransportEnvelope, ws: WebSocket): Promise<void> {
    console.log(`[Transport] Received message type: ${envelope.type}`);

    // Auth check for certain message types (skip for initial auth handshake)
    if (envelope.type !== 'AUTH_REQUEST') {
      const authToken = (envelope.payload as any)?.authToken;
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
    } catch (err) {
      console.error(`[Transport] Handler error for ${envelope.type}:`, err);
      this.sendError(ws, `Handler error: ${(err as Error).message}`);
    }
  }

  /**
   * Send a message to a specific client
   */
  send(ws: WebSocket, envelope: Omit<TransportEnvelope, 'ts'>): void {
    const fullEnvelope: TransportEnvelope = {
      ...envelope,
      ts: new Date().toISOString(),
    };
    ws.send(JSON.stringify(fullEnvelope));
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(envelope: Omit<TransportEnvelope, 'ts'>): void {
    const data = JSON.stringify({
      ...envelope,
      ts: new Date().toISOString(),
    });
    for (const ws of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /**
   * Send an error response
   */
  private sendError(ws: WebSocket, message: string): void {
    this.send(ws, {
      type: 'ERROR',
      id: uuidv4(),
      taskId: null,
      payload: { message },
    });
  }

  /**
   * Public error sender for handlers
   */
  public sendErrorPublic(ws: WebSocket, message: string): void {
    this.sendError(ws, message);
  }

  /**
   * Stop the WebSocket server
   */
  stop(): Promise<void> {
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

/**
 * Built-in message handlers for core Runtime operations
 */
export function registerCoreHandlers(transport: Transport, storage: Storage): void {
  // ============================================================================
  // AUTH_REQUEST - Initial authentication to get a token
  // ============================================================================
  transport.on('AUTH_REQUEST', async (envelope, ws) => {
    const { workspaceId } = envelope.payload as { workspaceId?: string };
    
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
    const { name, projectPath } = envelope.payload as { name: string; projectPath: string };
    
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
    const { workspaceId } = envelope.payload as { workspaceId: string };
    
    try {
      const workspace = storage.getWorkspace(workspaceId);
      transport.send(ws, {
        type: 'WORKSPACE_INFO',
        id: envelope.id,
        taskId: null,
        payload: { workspace },
      });
    } catch (err) {
      transport.sendErrorPublic(ws, (err as Error).message);
    }
  });

  // ============================================================================
  // SWITCH_WORKSPACE
  // ============================================================================
  transport.on('SWITCH_WORKSPACE', async (envelope, ws) => {
    const { workspaceId } = envelope.payload as { workspaceId: string };
    
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
    const { workspaceId, tabId, providerId, agentMode } = envelope.payload as {
      workspaceId: string;
      tabId: string;
      providerId: string;
      agentMode?: 'manual' | 'assistant' | 'autonomous';
    };
    
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
    const { workspaceId, tabId } = envelope.payload as { workspaceId: string; tabId: string };
    
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
    const { workspaceId, tabId, mode } = envelope.payload as {
      workspaceId: string;
      tabId: string;
      mode: 'manual' | 'assistant' | 'autonomous';
    };
    
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
    const { workspaceId, tool, state } = envelope.payload as {
      workspaceId: string;
      tool: string;
      state: PermissionState;
    };
    
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
    const { workspaceId, tool } = envelope.payload as { workspaceId: string; tool: string };
    
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
    const { workspaceId, prompt } = envelope.payload as { workspaceId: string; prompt: string };
    
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
    const { taskId } = envelope.payload as { taskId: string };
    
    try {
      const task = storage.getTask(taskId);
      transport.send(ws, {
        type: 'TASK_INFO',
        id: envelope.id,
        taskId: task.id,
        payload: { task },
      });
    } catch (err) {
      transport.sendErrorPublic(ws, (err as Error).message);
    }
  });

  // ============================================================================
  // UPDATE_TASK_STATUS
  // ============================================================================
  transport.on('UPDATE_TASK_STATUS', async (envelope, ws) => {
    const { taskId, status, step } = envelope.payload as {
      taskId: string;
      status: TaskStatus;
      step?: Record<string, unknown>;
    };
    
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
    const { role, tabId, providerId } = envelope.payload as {
      role: 'planner' | 'worker';
      tabId: string;
      providerId: string;
    };
    
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
    const { sessionId } = envelope.payload as { sessionId: string };
    
    try {
      const session = storage.getSession(sessionId);
      transport.send(ws, {
        type: 'SESSION_INFO',
        id: envelope.id,
        taskId: null,
        payload: { session },
      });
    } catch (err) {
      transport.sendErrorPublic(ws, (err as Error).message);
    }
  });

  // ============================================================================
  // UPDATE_SESSION_STATUS
  // ============================================================================
  transport.on('UPDATE_SESSION_STATUS', async (envelope, ws) => {
    const { sessionId, status } = envelope.payload as {
      sessionId: string;
      status: 'idle' | 'busy' | 'degraded' | 'lost';
    };
    
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
    const { tabId, instruction } = envelope.payload as {
      tabId: string;
      instruction: Record<string, unknown>;
    };
    
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

export default Transport;
