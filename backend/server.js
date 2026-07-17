// backend/server.js - Local AIOS Mock Runtime for Testing
const { WebSocketServer } = require('ws');

const PORT = 8765;
const HOST = '127.0.0.1';

console.log(`🚀 Starting AIOS Local Backend on ws://${HOST}:${PORT}`);

const wss = new WebSocketServer({ host: HOST, port: PORT });

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  console.log(`🤝 Client connected: ${clientId}`);

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📩 Received from ${clientId}:`, message.type);

      // Handle different message types
      switch (message.type) {
        case 'AUTH_REQUEST':
          // Send auth response with token
          const authToken = `aios-token-${Date.now()}`;
          ws.send(JSON.stringify({
            type: 'AUTH_RESPONSE',
            payload: { token: authToken },
            ts: new Date().toISOString()
          }));
          console.log(`✅ Auth sent to ${clientId}, token: ${authToken}`);
          
          // After successful auth, wait for CONNECT_TAB to get real tabId
          console.log(`⏳ Waiting for CONNECT_TAB from extension...`);
          break;

        case 'CONNECT_TAB':
          const connectedTabId = message.payload?.tabId;
          console.log(`📌 Tab connected: ${connectedTabId}`);
          
          // Now send a test TOOL REQUEST after 3 seconds using the REAL tabId
          setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
              console.log(`📤 Sending automated filesystem tool test to tab ${connectedTabId}...`);
              
              // Send a TOOL_REQUEST to read a file from the sandbox
              ws.send(JSON.stringify({
                type: 'TOOL_REQUEST',
                id: `test-${Date.now()}`,
                taskId: null,
                payload: {
                  tool: 'filesystem.read',
                  params: { filePath: 'test.txt' },
                  authToken: `aios-token-${Date.now()}`
                },
                ts: new Date().toISOString()
              }));
            }
          }, 3000);
          break;

        case 'DISCONNECT_TAB':
          console.log(`📴 Tab disconnected: ${message.payload?.tabId}`);
          break;

        case 'TOOL_REQUEST':
          console.log(`🛠️ Tool request received:`, message.payload);
          // Simulate tool execution
          ws.send(JSON.stringify({
            type: 'TOOL_RESULT',
            payload: {
              success: true,
              result: 'File read successfully (mock)',
              data: 'This is mock file content'
            },
            ts: new Date().toISOString()
          }));
          break;

        case 'ADAPTER_RESULT':
          console.log(`📊 Adapter result from ${message.payload?.tabId}:`, message.payload?.result);
          break;

        case 'SET_AGENT_MODE':
          console.log(`🤖 Agent mode set for ${message.payload?.tabId}: ${message.payload?.mode}`);
          break;

        default:
          console.log(`❓ Unknown message type: ${message.type}`);
      }
    } catch (e) {
      console.error(`❌ Error parsing message from ${clientId}:`, e);
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`👋 Client disconnected: ${clientId} | Code: ${code}, Reason: ${reason.toString()}`);
  });
  
  ws.on("error", (error) => {
    console.error(`⚠️ Error with client ${clientId}:`, error);
  });
});

wss.on('error', (error) => {
  console.error('❌ Server error:', error);
});

console.log(`✅ AIOS Backend is ready and listening on ws://${HOST}:${PORT}`);
console.log('Press Ctrl+C to stop the server');
