const pdfInteractionHandler = require('./pdfInteractionHandler');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`✓ New client connected: ${socket.id}`);

    // Join session room
    socket.on('join-session', (sessionId) => {
      if (typeof sessionId === 'string' && sessionId) {
        socket.join(sessionId);
        console.log(`✓ Client ${socket.id} joined session ${sessionId}`);
      } else {
        console.error(`Invalid sessionId from client ${socket.id}`);
      }
    });

    // Handle PDF interactions
    pdfInteractionHandler(socket, io);

    socket.on('disconnect', () => {
      console.log(`✓ Client disconnected: ${socket.id}`);
    });
  });
};