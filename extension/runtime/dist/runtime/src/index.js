"use strict";
/**
 * AIOS Runtime Entry Point
 * Per Runtime.md: "The always-on local process that owns every piece of state, every tool execution, and every security decision in AIOS."
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transport = exports.Storage = void 0;
const storage_1 = require("./storage");
Object.defineProperty(exports, "Storage", { enumerable: true, get: function () { return storage_1.Storage; } });
const transport_1 = require("./transport");
Object.defineProperty(exports, "Transport", { enumerable: true, get: function () { return transport_1.Transport; } });
const tools_1 = require("./tools");
async function main() {
    console.log('[Runtime] Starting AIOS Runtime...');
    // Initialize storage layer (SQLite)
    const storage = new storage_1.Storage();
    console.log('[Runtime] Storage initialized');
    // Initialize transport layer (WebSocket server)
    const transport = new transport_1.Transport({
        port: 8765,
        host: '127.0.0.1',
        storage,
    });
    // Register core message handlers
    (0, transport_1.registerCoreHandlers)(transport, storage);
    console.log('[Runtime] Core handlers registered');
    // Register TOOL_REQUEST handler for tool execution
    transport.on('TOOL_REQUEST', async (envelope, ws) => {
        console.log('[Runtime] Received TOOL_REQUEST:', envelope.payload);
        const payload = envelope.payload;
        const request = {
            tool: String(payload.tool || ''),
            params: payload.params || {},
            taskId: String(payload.taskId || ''),
        };
        const result = await tools_1.toolEngine.execute(request);
        transport.send(ws, {
            type: 'TOOL_RESULT',
            id: envelope.id,
            taskId: request.taskId,
            payload: result,
        });
    });
    console.log('[Runtime] Tool engine initialized with tools:', tools_1.toolEngine.listTools());
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('[Runtime] Shutting down...');
        // Mark any in-flight tasks as interrupted per Recovery.md
        storage.markTasksAsInterrupted();
        await transport.stop();
        storage.close();
        console.log('[Runtime] Shutdown complete');
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.log('[Runtime] Shutting down...');
        storage.markTasksAsInterrupted();
        await transport.stop();
        storage.close();
        process.exit(0);
    });
    // Start the WebSocket server
    try {
        await transport.start();
        console.log('[Runtime] AIOS Runtime is ready');
        console.log('[Runtime] Listening on ws://127.0.0.1:8765');
    }
    catch (err) {
        console.error('[Runtime] Failed to start:', err);
        process.exit(1);
    }
}
// Run the runtime
main().catch((err) => {
    console.error('[Runtime] Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map