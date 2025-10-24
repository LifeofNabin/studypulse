// backend/socket/index.js
// ADD THIS LINE at the top with other requires
const setupPDFInteractionHandlers = require('./pdfInteractionHandler');

// Your existing socket.io setup code...
// Then INSIDE the io.on('connection', (socket) => { ... }) add:

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Your existing socket handlers...
  // (join_room, metric, presence_verified, etc.)

  // ADD THIS LINE - Setup PDF interaction handlers
  setupPDFInteractionHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ==========================================
// COMPLETE EXAMPLE if you need full context:
// ==========================================

/*
const setupPDFInteractionHandlers = require('./pdfInteractionHandler');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('✅ New client connected:', socket.id);

    // Authenticate socket (if you have auth)
    if (socket.handshake.auth && socket.handshake.auth.token) {
      // Your auth logic here
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

    // Metrics handler (existing)
    socket.on('metric', (data) => {
      console.log('📊 Metric received:', data);
      io.to(`room_${data.room_id}`).emit('metric_update', data);
    });

    // Presence verified (existing)
    socket.on('presence_verified', (data) => {
      console.log('✅ Presence verified:', data);
      io.to(`room_${data.room_id}`).emit('presence_update', data);
    });

    // Presence failed (existing)
    socket.on('presence_failed', (data) => {
      console.log('❌ Presence failed:', data);
      io.to(`room_${data.room_id}`).emit('presence_alert', data);
    });

    // ⭐ NEW - Setup PDF interaction handlers
    setupPDFInteractionHandlers(io, socket);

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  return io;
};
*/