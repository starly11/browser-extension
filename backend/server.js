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
      console.log(`📩 Received from ${clientId}:`, message.type, JSON.stringify(message.payload || {}, null, 2));

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
          console.log(`📌 Tab connected: ${connectedTabId} | workspace: ${message.payload?.workspaceId}, mode: ${message.payload?.agentMode}`);
          
          // Now send a test instruction after 3 seconds using the REAL tabId
          setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
              console.log(`📤 Sending automated test instruction to tab ${connectedTabId}...`);
              
              // Send a SEND_PROMPT instruction to type text into ChatGPT
              ws.send(JSON.stringify({
                type: 'RELAY_TO_ADAPTER',
                payload: {
                  tabId: connectedTabId,
                  instruction: {
                    action: 'SEND_PROMPT',
                    prompt: 'Hello from your fully automated local AIOS runtime pipeline!'
                  }
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
          console.log(`📊 Adapter result from ${message.payload?.tabId}:`, JSON.stringify(message.payload?.result || {}, null, 2));
          break;

        case 'SET_AGENT_MODE':
          console.log(`🤖 Agent mode set for ${message.payload?.tabId}: ${message.payload?.mode}`);
          break;
          
        case 'USER_ACTION':
          console.log(`👤 User action intercepted:`, message.payload?.action, JSON.stringify(message.payload?.data || {}, null, 2));
          // Just acknowledge - mock server doesn't process actions yet
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
