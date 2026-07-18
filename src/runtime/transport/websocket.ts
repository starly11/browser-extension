import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { RuntimeMessage } from '../../shared/types.js';

interface Client {
  ws: WebSocket;
  id: string;
  isAuthenticated: boolean;
}

export class WebSocketTransport extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, Client> = new Map();
  private port: number;

  constructor(port: number = 9876) {
    super();
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.setupServer();
  }

  private setupServer(): void {
    console.log(`WebSocket server listening on port ${this.port}`);

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = randomUUID();
      console.log(`Client connected: ${clientId}`);

      const client: Client = {
        ws,
        id: clientId,
        isAuthenticated: false,
      };

      this.clients.set(clientId, client);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as RuntimeMessage;
          this.handleMessage(clientId, message);
        } catch (err) {
          console.error('Failed to parse message:', err);
          this.sendError(clientId, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        this.emit('client_disconnected', clientId);
      });

      ws.on('error', (err) => {
        console.error(`Client error (${clientId}):`, err);
        // Don't delete client here - let 'close' handle cleanup
      });

      // Send connection confirmation
      this.send(clientId, {
        type: 'connected',
        payload: { clientId },
      } as RuntimeMessage);
    });

    this.wss.on('error', (err) => {
      console.error('WebSocket server error:', err);
      this.emit('error', err);
    });
  }

  private handleMessage(clientId: string, message: RuntimeMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      console.error(`Client not found: ${clientId}`);
      return;
    }

    // For now, allow all messages without authentication (will add token auth later)
    // Simple request/response correlation using requestId
    this.emit('message', clientId, message);
  }

  send(clientId: string, message: RuntimeMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      console.error(`Cannot send to unknown client: ${clientId}`);
      return;
    }

    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    } else {
      console.error(`WebSocket not open for client: ${clientId}`);
    }
  }

  sendError(clientId: string, error: string, requestId?: string): void {
    this.send(clientId, {
      type: 'error',
      payload: { error },
      requestId,
    } as RuntimeMessage);
  }

  broadcast(message: RuntimeMessage): void {
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    this.wss.close();
    this.clients.clear();
  }
}
