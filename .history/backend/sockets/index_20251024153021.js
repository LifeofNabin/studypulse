const setupPDFInteractionHandlers = require('./pdfInteractionHandler');

module.exports = (io, db) => {
  io.on('connection', (socket) => {
    console.log('✅ New client connected:', socket.id);

    // Authenticate socket (if you have auth)
    if (socket.handshake.auth && socket.handshake.auth.token) {
      // Placeholder for auth logic; assumes userId is set
      socket.userId = socket.handshake.auth.userId;
    }

    // Join room handler
    socket.on('join_room', (data) => {
      const { room_id, session_id } = data;
      socket.join(`room_${room_id}`);
      console.log(`Socket ${socket.id} joined room ${room_id}`);
      
      // Also join teacher room if teacher
      if (socket.isTeacher) {
        socket.join(`room_${room_id}_teachers`);
      }
      
      socket.emit('joined_room', { 
        room_id,
        session_id,
        message: 'Successfully joined room' 
      });
    });

    // Metrics handler
    socket.on('metric', (data) => {
      console.log('📊 Metric received:', data);
      io.to(`room_${data.room_id}`).emit('metric_update', data);
    });

    // Presence verified
    socket.on('presence_verified', (data) => {
      console.log('✅ Presence verified:', data);
      io.to(`room_${data.room_id}`).emit('presence_update', data);
    });

    // Presence failed
    socket.on('presence_failed', (data) => {
      console.log('❌ Presence failed:', data);
      io.to(`room_${data.room_id}`).emit('presence_alert', data);
    });

    // Setup PDF interaction handlers
    setupPDFInteractionHandlers(io, socket);

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  return io;
};