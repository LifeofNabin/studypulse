// Debug version with error handling
console.log('=== Starting debug server ===');

try {
  console.log('1. Loading modules...');
  const express = require('express');
  console.log('✓ Express loaded');
  
  const cors = require('cors');
  console.log('✓ CORS loaded');
  
  const bcrypt = require('bcryptjs');
  console.log('✓ BCrypt loaded');
  
  const jwt = require('jsonwebtoken');
  console.log('✓ JWT loaded');
  
  const { MongoClient, ObjectId } = require('mongodb');
  console.log('✓ MongoDB loaded');
  
  const http = require('http');
  console.log('✓ HTTP loaded');
  
  const socketIo = require('socket.io');
  console.log('✓ Socket.IO loaded');
  
  const { v4: uuidv4 } = require('uuid');
  console.log('✓ UUID loaded');
  
  console.log('2. Loading dotenv...');
  require('dotenv').config();
  console.log('✓ Dotenv loaded');

  console.log('3. Creating Express app...');
  const app = express();
  const server = http.createServer(app);
  console.log('✓ Express app created');

  console.log('4. Setting up Socket.IO...');
  const io = socketIo(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });
  console.log('✓ Socket.IO setup complete');

  console.log('5. Setting up middleware...');
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*']
  }));
  app.use(express.json());
  console.log('✓ Middleware setup complete');

  console.log('6. Setting up basic route...');
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString() 
    });
  });
  console.log('✓ Health route setup complete');

  console.log('7. Connecting to MongoDB...');
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
  const dbName = process.env.DB_NAME || 'studyguardian';
  
  console.log(`MongoDB URL: ${mongoUrl}`);
  console.log(`Database Name: ${dbName}`);

  let db;
  MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
    .then(client => {
      console.log('✓ Connected to MongoDB');
      db = client.db(dbName);
      
      console.log('8. Starting server...');
      const PORT = process.env.PORT || 8000;
      server.listen(PORT, () => {
        console.log(`✓ Server running on http://localhost:${PORT}`);
        console.log('=== Server startup complete ===');
      });
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    });

} catch (error) {
  console.error('❌ Error during server startup:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}
