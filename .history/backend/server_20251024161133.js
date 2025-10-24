const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');
const { connectToMongoDB } = require('./config/db');
const { configurePassport } = require('./config/passport');
const configureSocketIO = require('./sockets');
const PDFInteraction = require('./models/PDFInteraction');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'Uploads')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URL,
    collectionName: 'sessions',
  }),
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24*60*60*1000, httpOnly: true },
}));

app.use(passport.initialize());
app.use(passport.session());

// MongoDB middleware
app.use(async (req, res, next) => {
  if (!app.locals.db) {
    const db = await connectToMongoDB();
    app.locals.db = db;
  }
  req.db = app.locals.db;
  next();
});

// Routes
app.use('/api/auth', require('./routes/authRoutes')); // corrected
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/students', require('./routes/students'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/ai', require('./routes/ai'));

// Test endpoints
app.get('/api/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));
app.get('/api/test', (req, res) => res.json({ message: 'Server is working', rooms: [] }));

// Error handler (after routes)
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  try {
    const db = await connectToMongoDB();
    app.locals.db = db;

    configurePassport(db);
    configureSocketIO(io, db, PDFInteraction);

    const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('Socket.IO ready for real-time connections');
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

startServer();
