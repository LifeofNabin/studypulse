const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const { connectToMongoDB } = require('./config/db');
const { configurePassport } = require('./config/passport');
const configureSocketIO = require('./socket');
const PDFInteraction = require('./models/PDFInteraction'); // Import PDFInteraction model
require('dotenv').config();

console.log('Starting StudyGuardian server...');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Uploads'))); // Serve /Uploads/pdfs
app.use(session({
  secret: process.env.SESSION_SECRET || 'studyguardian-session-secret-2024-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Routes
connectToMongoDB()
  .then(db => {
    console.log('✓ MongoDB connection established');
    app.locals.db = db; // Store db in app.locals
    configurePassport(db); // Configure Passport with db
    configureSocketIO(io, db, PDFInteraction); // Pass PDFInteraction to Socket.IO handlers

    // Attach routes
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/rooms', require('./routes/rooms'));
    app.use('/api/sessions', require('./routes/sessions'));
    app.use('/api/students', require('./routes/students'));
    app.use('/api/teacher', require('./routes/teacher'));
    app.use('/api/ai', require('./routes/ai')); // Added for ai.js
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Middleware to attach db to req
app.use((req, res, next) => {
  req.db = app.locals.db;
    next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working', rooms: [] });
});

// Start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Socket.IO ready for real-time connections`);
});