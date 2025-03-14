const http = require('http');
const WebSocket = require('ws');

// Rolling message buffer with metadata
class MessageBuffer {
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.buffer = [];
  }

  add(message) {
    const bufferedMessage = {
      ...message,
      timestamp: new Date().toISOString()
    };

    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(bufferedMessage);
  }

  getAll() {
    return this.buffer;
  }
}

// Create message buffer
const messageBuffer = new MessageBuffer();

// Create HTTP server
const server = http.createServer();

// Create server path

const path = '/chat/ws'

console.log('Server running on path "' + path + '"')

// Create WebSocket server
const wss = new WebSocket.Server({
  server,
  path: path
});

// Track connected users
const users = new Set();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send message history upon connection
  ws.send(JSON.stringify({
    type: 'message_history',
    messages: messageBuffer.getAll()
  }));

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'login':
          // Add user to the set of connected users
          ws.username = message.username;
          users.add(message.username);

          // Broadcast updated user list to all clients
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'user_list',
                users: Array.from(users)
              }));
            }
          });
          break;

        case 'message':
          // Add message to buffer and broadcast
          const chatMessage = {
            type: 'message',
            username: message.username || 'Anonymous',
            text: message.text
          };

          messageBuffer.add(chatMessage);

          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(chatMessage));
            }
          });
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    // Remove user from the set if username exists
    if (ws.username) {
      users.delete(ws.username);

      // Broadcast updated user list
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'user_list',
            users: Array.from(users)
          }));
        }
      });
    }
  });

  // Send initial user list
  ws.send(JSON.stringify({
    type: 'user_list',
    users: Array.from(users)
  }));
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
