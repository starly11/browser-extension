/**
 * AIOS Runtime Entry Point
 * Per Runtime.md: "The always-on local process that owns every piece of state, every tool execution, and every security decision in AIOS."
 */

import { Storage } from './storage';
import { Transport, registerCoreHandlers } from './transport';
import { toolEngine } from './tools';
import { ToolRequest } from '@shared/types';

async function main(): Promise<void> {
  console.log('[Runtime] Starting AIOS Runtime...');

  // Initialize storage layer (SQLite)
  const storage = new Storage();
  console.log('[Runtime] Storage initialized');

  // Initialize transport layer (WebSocket server)
  const transport = new Transport({
    port: 8765,
    host: '127.0.0.1',
    storage,
  });

  // Register core message handlers
  registerCoreHandlers(transport, storage);
  console.log('[Runtime] Core handlers registered');

  // Register TOOL_REQUEST handler for tool execution
  transport.on('TOOL_REQUEST', async (envelope, ws) => {
    console.log('[Runtime] Received TOOL_REQUEST:', envelope.payload);
    
    const payload = envelope.payload as Record<string, unknown>;
    const request: ToolRequest = {
      tool: String(payload.tool || ''),
      params: (payload.params as Record<string, unknown>) || {},
      taskId: String(payload.taskId || ''),
    };
    const result = await toolEngine.execute(request);
    
    transport.send(ws, {
      type: 'TOOL_RESULT',
      id: envelope.id,
      taskId: request.taskId,
      payload: result as unknown as Record<string, unknown>,
    });
  });
  console.log('[Runtime] Tool engine initialized with tools:', toolEngine.listTools());

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
  } catch (err) {
    console.error('[Runtime] Failed to start:', err);
    process.exit(1);
  }
}

// Run the runtime
main().catch((err) => {
  console.error('[Runtime] Fatal error:', err);
  process.exit(1);
});

export { Storage, Transport };
