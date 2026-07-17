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
          
          // After successful auth, send a test prompt after 3 seconds
          setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
              console.log(`📤 Sending automated test instruction to ${clientId}...`);
              ws.send(JSON.stringify({
                type: 'RELAY_TO_ADAPTER',
                payload: {
                  tabId: 'test-tab-1',
                  instruction: {
                    action: 'SEND_PROMPT',
                    prompt: 'Hello from your fully automated local AIOS runtime pipeline! This is an automated test message.'
                  }
                },
                ts: new Date().toISOString()
              }));
            }
          }, 3000);
          break;

        case 'CONNECT_TAB':
          console.log(`📌 Tab connected: ${message.payload?.tabId}`);
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

  ws.on('close', () => {
    console.log(`👋 Client disconnected: ${clientId}`);
  });

  ws.on('error', (error) => {
    console.error(`⚠️ Error with client ${clientId}:`, error);
  });
});

wss.on('error', (error) => {
  console.error('❌ Server error:', error);
});

console.log(`✅ AIOS Backend is ready and listening on ws://${HOST}:${PORT}`);
console.log('Press Ctrl+C to stop the server');
