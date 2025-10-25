// backend/server.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: GitHubStrategy } = require('passport-github2');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

console.log('Starting StudyGuardian server...');

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// CORS configuration - MUST allow credentials for cookies
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/studyguardian';
let db;

console.log('Connecting to MongoDB...');
MongoClient.connect(MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
  .then(client => {
    db = client.db();
    console.log('✓ Connected to MongoDB');
    
    // Create indexes for refresh tokens (auto-delete expired tokens)
    db.collection('refresh_tokens').createIndex(
      { "expiresAt": 1 }, 
      { expireAfterSeconds: 0 }
    ).then(() => {
      console.log('✓ Refresh token index created');
    }).catch(err => {
      console.error('Index creation warning:', err.message);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Mongoose connection
mongoose.connect(MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
  .then(() => console.log('✓ Mongoose connected'))
  .catch(err => console.error('Mongoose connection error:', err));

// Middleware to attach db and io to requests
app.use((req, res, next) => {
  req.db = db;
  req.io = io;
  next();
});

// Passport Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/auth/google/callback`
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await db.collection('users').findOne({ email: profile.emails[0].value });
      
      if (!user) {
        const { v4: uuidv4 } = require('uuid');
        user = {
          id: uuidv4(),
          email: profile.emails[0].value,
          name: profile.displayName,
          role: 'student',
          created_at: new Date(),
          lastLogin: new Date(),
          provider: 'google'
        };
        await db.collection('users').insertOne(user);
      } else {
        await db.collection('users').updateOne(
          { id: user.id },
          { $set: { lastLogin: new Date() } }
        );
      }
      
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }));
  console.log('✓ Google OAuth configured');
}

// Passport GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/auth/github/callback`
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.username}@github.com`;
      let user = await db.collection('users').findOne({ email });
      
      if (!user) {
        const { v4: uuidv4 } = require('uuid');
        user = {
          id: uuidv4(),
          email,
          name: profile.displayName || profile.username,
          role: 'student',
          created_at: new Date(),
          lastLogin: new Date(),
          provider: 'github'
        };
        await db.collection('users').insertOne(user);
      } else {
        await db.collection('users').updateOne(
          { id: user.id },
          { $set: { lastLogin: new Date() } }
        );
      }
      
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }));
  console.log('✓ GitHub OAuth configured');
}

// Import routes
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const studentsRoutes = require('./routes/students'); // Your existing students.js file
const { authenticateToken } = require('./middleware/auth');

// Optional: Import other routes if they exist
let roomsRoutes, sessionsRoutes, analyticsRoutes, aiRoutes;
try {
  roomsRoutes = require('./routes/rooms');
} catch (e) {
  console.log('⚠️  rooms.js not found, skipping...');
}
try {
  sessionsRoutes = require('./routes/sessions');
} catch (e) {
  console.log('⚠️  sessions.js not found, skipping...');
}
try {
  analyticsRoutes = require('./routes/analytics');
} catch (e) {
  console.log('⚠️  analytics.js not found, skipping...');
}
try {
  aiRoutes = require('./routes/ai');
} catch (e) {
  console.log('⚠️  ai.js not found, skipping...');
}

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/students', studentsRoutes); // Using your existing students.js

// Mount optional routes if they exist
if (roomsRoutes) app.use('/api/rooms', roomsRoutes);
if (sessionsRoutes) app.use('/api/sessions', sessionsRoutes);
if (analyticsRoutes) app.use('/api/analytics', analyticsRoutes);
if (aiRoutes) app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mongodb: db ? 'connected' : 'disconnected'
  });
});

// Protected route example
app.get('/api/me', authenticateToken, (req, res) => {
  const { password, _id, ...userWithoutSensitive } = req.user;
  res.json(userWithoutSensitive);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✓ New client connected:', socket.id);

  // Authenticate socket connection
  const token = socket.handshake.auth.token;
  if (token) {
    const jwt = require('jsonwebtoken');
    const SECRET_KEY = process.env.SECRET_KEY || 'study-guardian-secret-key-2024';
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      socket.userId = decoded.sub;
      console.log('✓ Socket authenticated for user:', socket.userId);
    } catch (err) {
      console.error('Socket auth error:', err.message);
    }
  }

  // PDF interaction handler
  socket.on('pdf-interaction', async (data) => {
    try {
      console.log('📚 PDF interaction received:', data);
      
      // Store interaction in database
      if (db && socket.userId) {
        await db.collection('pdf_interactions').insertOne({
          userId: socket.userId,
          ...data,
          timestamp: new Date()
        });
      }
      
      // Broadcast to room if applicable
      if (data.roomId) {
        socket.to(data.roomId).emit('pdf-interaction', data);
      }
    } catch (error) {
      console.error('Error handling PDF interaction:', error);
    }
  });

  // Room management
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`✓ User ${socket.id} joined room: ${roomId}`);
    socket.to(roomId).emit('user-joined', { socketId: socket.id, userId: socket.userId });
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`✓ User ${socket.id} left room: ${roomId}`);
    socket.to(roomId).emit('user-left', { socketId: socket.id, userId: socket.userId });
  });

  // Study session events
  socket.on('study-session-start', async (data) => {
    try {
      console.log('📖 Study session started:', data);
      if (db && socket.userId) {
        await db.collection('study_sessions').insertOne({
          userId: socket.userId,
          roomId: data.roomId,
          startTime: new Date(),
          status: 'active'
        });
      }
    } catch (error) {
      console.error('Error starting study session:', error);
    }
  });

  socket.on('study-session-end', async (data) => {
    try {
      console.log('📕 Study session ended:', data);
      if (db && socket.userId) {
        await db.collection('study_sessions').updateOne(
          { userId: socket.userId, status: 'active' },
          { 
            $set: { 
              endTime: new Date(),
              status: 'completed',
              duration: data.duration
            }
          }
        );
      }
    } catch (error) {
      console.error('Error ending study session:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('✗ Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
    detail: err.message || 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ detail: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log('✓ Socket.IO ready for real-time connections');
  console.log('✓ All routes mounted successfully');
});