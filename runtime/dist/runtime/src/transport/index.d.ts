/**
 * Transport Layer - Local WebSocket server with token auth
 * Per Runtime.md: "Exposes a stable protocol so the Extension, and eventually a Desktop app or VS Code plugin, can all drive the same Runtime."
 * Per Security.md: "The local Runtime's endpoint binds to loopback only (127.0.0.1), never 0.0.0.0. The Extension authenticates with a token."
 */
import { WebSocket } from 'ws';
import { Storage } from '../storage';
import { TransportEnvelope } from '@shared/types';
export interface TransportConfig {
    port?: number;
    host?: string;
    storage: Storage;
}
type MessageHandler = (envelope: TransportEnvelope, ws: WebSocket) => Promise<void>;
export declare class Transport {
    private wss;
    private port;
    private host;
    private storage;
    private handlers;
    private connections;
    constructor(config: TransportConfig);
    /**
     * Register a handler for a specific message type
     */
    on(type: string, handler: MessageHandler): void;
    /**
     * Start the WebSocket server
     */
    start(): Promise<void>;
    /**
     * Handle incoming messages with auth validation
     */
    private handleMessage;
    /**
     * Send a message to a specific client
     */
    send(ws: WebSocket, envelope: Omit<TransportEnvelope, 'ts'>): void;
    /**
     * Broadcast a message to all connected clients
     */
    broadcast(envelope: Omit<TransportEnvelope, 'ts'>): void;
    /**
     * Send an error response
     */
    private sendError;
    /**
     * Public error sender for handlers
     */
    sendErrorPublic(ws: WebSocket, message: string): void;
    /**
     * Stop the WebSocket server
     */
    stop(): Promise<void>;
}
/**
 * Built-in message handlers for core Runtime operations
 */
export declare function registerCoreHandlers(transport: Transport, storage: Storage): void;
export default Transport;
//# sourceMappingURL=index.d.ts.map