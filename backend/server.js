const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

console.log('Starting StudyGuardian server...');

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*']
}));

app.use(express.json());

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads', 'pdfs');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// MongoDB connection
let db;
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'studyguardian';

console.log('Connecting to MongoDB...');
MongoClient.connect(mongoUrl)
  .then(client => {
    console.log('✓ Connected to MongoDB');
    db = client.db(dbName);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// JWT settings
const SECRET_KEY = process.env.SECRET_KEY || 'study-guardian-secret-key-2024';
const ACCESS_TOKEN_EXPIRE_MINUTES = 30;

// Helper functions
const hashPassword = (password) => {
  return bcrypt.hashSync(password, 10);
};

const verifyPassword = (password, hash) => {
  return bcrypt.compareSync(password, hash);
};

const createAccessToken = (userId) => {
  return jwt.sign(
    { sub: userId },
    SECRET_KEY,
    { expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m` }
  );
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ detail: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await db.collection('users').findOne({ id: decoded.sub });
    
    if (!user) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid token' });
  }
};

// Role-based middleware
const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ detail: `Only ${role}s can access this endpoint` });
    }
    next();
  };
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString() 
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working', rooms: [] });
});

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Check if user exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ detail: 'Email already registered' });
    }

    // Create user
    const hashedPassword = hashPassword(password);
    const user = {
      id: uuidv4(),
      email,
      name,
      role,
      created_at: new Date()
    };

    await db.collection('users').insertOne({
      ...user,
      password: hashedPassword
    });

    // Generate token
    const accessToken = createAccessToken(user.id);

    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      user
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

    // Find user
    const user = await db.collection('users').findOne({ email });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    // Generate token
    const accessToken = createAccessToken(user.id);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    console.log('Login successful for:', email);
    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Room endpoints
app.post('/api/rooms', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { title, subject, description, duration = 60 } = req.body;

    const room = {
      id: uuidv4(),
      title,
      subject,
      description,
      teacher_id: req.user.id,
      room_code: uuidv4().slice(0, 8).toUpperCase(),
      is_active: true,
      created_at: new Date(),
      duration
    };

    await db.collection('rooms').insertOne(room);
    delete room._id;
    res.json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'teacher') {
      query = { teacher_id: req.user.id };
    } else {
      query = { is_active: true };
    }

    const rooms = await db.collection('rooms').find(query).toArray();
    
    // Add student count for each room
    for (let room of rooms) {
      const activeSessionsCount = await db.collection('sessions').countDocuments({
        room_id: room.id,
        is_active: true
      });
      room.students_count = activeSessionsCount;
      room.status = room.is_active ? 'active' : 'inactive';
      
      // Include PDF info for students (only if they need it)
      if (room.pdf_file && req.user.role === 'student') {
        room.has_pdf = true;
      }
      
      delete room._id;
    }

    res.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Teacher-specific endpoints
app.get('/api/teacher/rooms', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const rooms = await db.collection('rooms').find({ teacher_id: req.user.id }).toArray();
    
    // Add student count for each room
    for (let room of rooms) {
      const activeSessionsCount = await db.collection('sessions').countDocuments({
        room_id: room.id,
        is_active: true
      });
      room.students_count = activeSessionsCount;
      room.status = room.is_active ? 'active' : 'inactive';
      
      // Include PDF info but only name and uploaded_at (not path)
      if (room.pdf_file) {
        room.pdf_file = {
          name: room.pdf_file.name,
          uploaded_at: room.pdf_file.uploaded_at
        };
      }
      
      delete room._id;
    }

    res.json(rooms);
  } catch (error) {
    console.error('Get teacher rooms error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

app.post('/api/teacher/rooms', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { title, subject, description, duration = 60 } = req.body;

    const room = {
      id: uuidv4(),
      title,
      subject,
      description,
      teacher_id: req.user.id,
      room_code: uuidv4().slice(0, 8).toUpperCase(),
      is_active: true,
      created_at: new Date(),
      duration,
      students_count: 0,
      status: 'active'
    };

    await db.collection('rooms').insertOne(room);
    delete room._id;
    res.json(room);
  } catch (error) {
    console.error('Create teacher room error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

app.delete('/api/teacher/rooms/:roomId', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await db.collection('rooms').findOne({ 
      id: roomId, 
      teacher_id: req.user.id 
    });
    
    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    // Delete associated PDF file if exists
    if (room.pdf_file && room.pdf_file.path) {
      try {
        await fs.unlink(room.pdf_file.path);
      } catch (err) {
        console.log('PDF file not found or already deleted');
      }
    }

    // End all active sessions
    await db.collection('sessions').updateMany(
      { room_id: roomId, is_active: true },
      { $set: { is_active: false, end_time: new Date() } }
    );

    // Delete room
    await db.collection('rooms').deleteOne({ id: roomId });

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// PDF Upload endpoint
app.post('/api/teacher/rooms/:roomId/upload-pdf', 
  authenticateToken, 
  requireRole('teacher'), 
  upload.single('pdf'),
  async (req, res) => {
    try {
      const { roomId } = req.params;

      if (!req.file) {
        return res.status(400).json({ detail: 'No PDF file provided' });
      }

      // Verify room belongs to teacher
      const room = await db.collection('rooms').findOne({ 
        id: roomId, 
        teacher_id: req.user.id 
      });
      
      if (!room) {
        // Delete uploaded file if room not found
        await fs.unlink(req.file.path);
        return res.status(404).json({ detail: 'Room not found' });
      }

      // Delete old PDF if exists
      if (room.pdf_file && room.pdf_file.path) {
        try {
          await fs.unlink(room.pdf_file.path);
        } catch (err) {
          console.log('Old PDF file not found or already deleted');
        }
      }

      // Update room with PDF info
      const pdfInfo = {
        name: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        uploaded_at: new Date()
      };

      await db.collection('rooms').updateOne(
        { id: roomId },
        { $set: { pdf_file: pdfInfo } }
      );

      res.json({
        message: 'PDF uploaded successfully',
        pdf_file: {
          name: pdfInfo.name,
          uploaded_at: pdfInfo.uploaded_at
        }
      });
    } catch (error) {
      console.error('Upload PDF error:', error);
      // Clean up uploaded file on error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          console.log('Failed to delete uploaded file');
        }
      }
      res.status(500).json({ detail: 'Failed to upload PDF' });
    }
  }
);

// Remove PDF from room
app.delete('/api/teacher/rooms/:roomId/pdf', 
  authenticateToken, 
  requireRole('teacher'), 
  async (req, res) => {
    try {
      const { roomId } = req.params;

      // Verify room belongs to teacher
      const room = await db.collection('rooms').findOne({ 
        id: roomId, 
        teacher_id: req.user.id 
      });
      
      if (!room) {
        return res.status(404).json({ detail: 'Room not found' });
      }

      if (!room.pdf_file) {
        return res.status(404).json({ detail: 'No PDF file found' });
      }

      // Delete the physical file
      try {
        await fs.unlink(room.pdf_file.path);
      } catch (err) {
        console.log('PDF file not found on disk, removing from database anyway');
      }

      // Remove PDF info from room
      await db.collection('rooms').updateOne(
        { id: roomId },
        { $unset: { pdf_file: "" } }
      );

      res.json({ message: 'PDF removed successfully' });
    } catch (error) {
      console.error('Remove PDF error:', error);
      res.status(500).json({ detail: 'Failed to remove PDF' });
    }
  }
);

// Get PDF file for students
app.get('/api/rooms/:roomId/pdf', 
  authenticateToken, 
  requireRole('student'), 
  async (req, res) => {
    try {
      const { roomId } = req.params;

      // Verify student has an active session in this room
      const session = await db.collection('sessions').findOne({
        room_id: roomId,
        student_id: req.user.id,
        is_active: true
      });

      if (!session) {
        return res.status(403).json({ detail: 'You must join this room first' });
      }

      const room = await db.collection('rooms').findOne({ id: roomId });
      
      if (!room) {
        return res.status(404).json({ detail: 'Room not found' });
      }

      if (!room.pdf_file || !room.pdf_file.path) {
        return res.status(404).json({ detail: 'No PDF file available for this room' });
      }

      // Check if file exists
      try {
        await fs.access(room.pdf_file.path);
      } catch (err) {
        return res.status(404).json({ detail: 'PDF file not found on server' });
      }

      // Serve the PDF file
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${room.pdf_file.name}"`);
      res.sendFile(path.resolve(room.pdf_file.path));
    } catch (error) {
      console.error('Get PDF error:', error);
      res.status(500).json({ detail: 'Failed to retrieve PDF' });
    }
  }
);

// Get PDF info for a room (without downloading)
app.get('/api/rooms/:roomId/pdf-info',
  authenticateToken,
  async (req, res) => {
    try {
      const { roomId } = req.params;

      const room = await db.collection('rooms').findOne({ id: roomId });
      
      if (!room) {
        return res.status(404).json({ detail: 'Room not found' });
      }

      if (!room.pdf_file) {
        return res.json({ has_pdf: false });
      }

      res.json({
        has_pdf: true,
        name: room.pdf_file.name,
        uploaded_at: room.pdf_file.uploaded_at
      });
    } catch (error) {
      console.error('Get PDF info error:', error);
      res.status(500).json({ detail: 'Failed to retrieve PDF info' });
    }
  }
);

app.get('/api/teacher/students', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    // Get teacher's rooms
    const teacherRooms = await db.collection('rooms').find({ teacher_id: req.user.id }).toArray();
    const roomIds = teacherRooms.map(room => room.id);

    // Get sessions from teacher's rooms
    const sessions = await db.collection('sessions').find({ 
      room_id: { $in: roomIds } 
    }).toArray();

    // Group by student
    const studentStats = {};
    
    for (let session of sessions) {
      const studentId = session.student_id;
      
      if (!studentStats[studentId]) {
        const student = await db.collection('users').findOne({ id: studentId });
        if (student) {
          studentStats[studentId] = {
            id: studentId,
            name: student.name,
            email: student.email,
            class: '10th Grade',
            total_sessions: 0,
            avg_attention: 0,
            last_session: null,
            status: 'active'
          };
        }
      }

      if (studentStats[studentId]) {
        studentStats[studentId].total_sessions += 1;
        if (session.end_time) {
          studentStats[studentId].last_session = session.end_time;
        } else if (!studentStats[studentId].last_session) {
          studentStats[studentId].last_session = session.start_time;
        }
      }
    }

    // Calculate average attention
    for (let studentId in studentStats) {
      const studentSessions = sessions.filter(s => s.student_id === studentId);
      const sessionIds = studentSessions.map(s => s.id);
      
      if (sessionIds.length > 0) {
        const metrics = await db.collection('metrics').find({ 
          session_id: { $in: sessionIds } 
        }).toArray();
        
        const attentionScores = metrics
          .map(m => m.attention_score)
          .filter(score => score != null);
        
        if (attentionScores.length > 0) {
          studentStats[studentId].avg_attention = Math.round(
            attentionScores.reduce((a, b) => a + b, 0) / attentionScores.length
          );
        }
      }
    }

    res.json(Object.values(studentStats));
  } catch (error) {
    console.error('Get teacher students error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

app.get('/api/teacher/students/:studentId', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await db.collection('users').findOne({ 
      id: studentId, 
      role: 'student' 
    });
    
    if (!student) {
      return res.status(404).json({ detail: 'Student not found' });
    }

    res.json({
      id: student.id,
      name: student.name,
      email: student.email,
      class: '10th Grade',
      enrollment_date: student.created_at
    });
  } catch (error) {
    console.error('Get student info error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

app.get('/api/teacher/students/:studentId/progress', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { period = 'week' } = req.query;

    // Verify student exists
    const student = await db.collection('users').findOne({ 
      id: studentId, 
      role: 'student' 
    });
    
    if (!student) {
      return res.status(404).json({ detail: 'Student not found' });
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(0);
    }

    // Get teacher's rooms
    const teacherRooms = await db.collection('rooms').find({ teacher_id: req.user.id }).toArray();
    const roomIds = teacherRooms.map(room => room.id);

    // Get student's sessions in teacher's rooms
    const sessions = await db.collection('sessions').find({
      student_id: studentId,
      room_id: { $in: roomIds },
      start_time: { $gte: startDate }
    }).toArray();

    if (sessions.length === 0) {
      return res.json({
        totalStudyTime: 0,
        averageAttention: 0,
        averageFatigue: 0,
        totalSessions: 0,
        recentSessions: [],
        subjectStats: [],
        attentionTrend: [],
        alerts: []
      });
    }

    // Get metrics
    const sessionIds = sessions.map(s => s.id);
    const metrics = await db.collection('metrics').find({ 
      session_id: { $in: sessionIds } 
    }).toArray();

    // Calculate statistics
    let totalStudyTime = 0;
    const attentionScores = [];
    const fatigueScores = [];

    sessions.forEach(session => {
      if (session.end_time) {
        const duration = (new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60);
        totalStudyTime += duration;
      }
    });

    metrics.forEach(metric => {
      if (metric.attention_score != null) attentionScores.push(metric.attention_score);
      if (metric.fatigue_level != null) fatigueScores.push(metric.fatigue_level);
    });

    const avgAttention = attentionScores.length > 0 
      ? attentionScores.reduce((a, b) => a + b, 0) / attentionScores.length 
      : 0;
    
    const avgFatigue = fatigueScores.length > 0 
      ? fatigueScores.reduce((a, b) => a + b, 0) / fatigueScores.length 
      : 0;

    // Recent sessions
    const recentSessions = [];
    const sortedSessions = sessions.sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).slice(0, 10);
    
    for (let session of sortedSessions) {
      const room = await db.collection('rooms').findOne({ id: session.room_id });
      const duration = session.end_time 
        ? (new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60)
        : 0;
      
      const sessionMetrics = metrics.filter(m => m.session_id === session.id);
      const sessionAttention = sessionMetrics.length > 0
        ? sessionMetrics.reduce((sum, m) => sum + (m.attention_score || 0), 0) / sessionMetrics.length
        : 0;
      const sessionFatigue = sessionMetrics.length > 0
        ? sessionMetrics.reduce((sum, m) => sum + (m.fatigue_level || 0), 0) / sessionMetrics.length
        : 0;

      recentSessions.push({
        date: session.start_time,
        subject: room ? room.subject : 'Unknown',
        duration: Math.round(duration),
        avgAttention: Math.round(sessionAttention),
        avgFatigue: Math.round(sessionFatigue)
      });
    }

    res.json({
      totalStudyTime: Math.round(totalStudyTime),
      averageAttention: Math.round(avgAttention),
      averageFatigue: Math.round(avgFatigue),
      totalSessions: sessions.length,
      recentSessions,
      subjectStats: [],
      attentionTrend: [],
      alerts: [],
      dailyStats: [],
      goals: {
        dailyTarget: 180,
        weeklyTarget: 1260,
        targetAttention: 75
      },
      achievements: [
        { title: 'Study Streak', description: 'Active learner', icon: '🔥', earned: true },
        { title: 'Focus Master', description: 'Good attention levels', icon: '🎯', earned: false }
      ]
    });
  } catch (error) {
    console.error('Get student progress error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Join room
app.post('/api/rooms/:roomCode/join', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { roomCode } = req.params;

    const room = await db.collection('rooms').findOne({ 
      room_code: roomCode, 
      is_active: true 
    });
    
    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    const session = {
      id: uuidv4(),
      room_id: room.id,
      student_id: req.user.id,
      start_time: new Date(),
      end_time: null,
      is_active: true,
      consent: false
    };

    await db.collection('sessions').insertOne(session);
    res.json({ 
      message: 'Joined room successfully', 
      session_id: session.id,
      room: {
        id: room.id,
        title: room.title,
        subject: room.subject,
        description: room.description,
        has_pdf: room.pdf_file ? true : false
      }
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Student goals endpoints
app.get('/api/students/goals', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const goals = await db.collection('goals').find({ 
      student_id: req.user.id 
    }).toArray();

    // Calculate progress for each goal
    const goalsWithProgress = await Promise.all(goals.map(async (goal) => {
      // Get study sessions for this goal
      const sessions = await db.collection('sessions').find({
        student_id: req.user.id,
        start_time: { 
          $gte: new Date(goal.startDate), 
          $lte: new Date(goal.endDate + 'T23:59:59.999Z') 
        },
        end_time: { $ne: null }
      }).toArray();

      // Calculate studied minutes
      let studiedMinutes = 0;
      sessions.forEach(session => {
        if (session.end_time) {
          const duration = (new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60);
          studiedMinutes += duration;
        }
      });

      const progress = Math.min((studiedMinutes / goal.targetMinutes) * 100, 100);

      return {
        ...goal,
        studiedMinutes: Math.round(studiedMinutes),
        progress: Math.round(progress)
      };
    }));

    // Remove MongoDB ObjectId
    goalsWithProgress.forEach(goal => delete goal._id);

    res.json(goalsWithProgress);
  } catch (error) {
    console.error('Get student goals error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

app.post('/api/students/goals', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { subject, targetMinutes, period, startDate, endDate, description } = req.body;

    const goal = {
      id: uuidv4(),
      student_id: req.user.id,
      subject,
      targetMinutes,
      period,
      startDate,
      endDate,
      description: description || '',
      created_at: new Date(),
      status: 'active'
    };

    await db.collection('goals').insertOne(goal);
    delete goal._id;

    res.json({
      ...goal,
      studiedMinutes: 0,
      progress: 0
    });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

app.delete('/api/students/goals/:goalId', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { goalId } = req.params;

    const goal = await db.collection('goals').findOne({ 
      id: goalId, 
      student_id: req.user.id 
    });
    
    if (!goal) {
      return res.status(404).json({ detail: 'Goal not found' });
    }

    await db.collection('goals').deleteOne({ id: goalId });

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Session endpoints
app.post('/api/sessions/:sessionId/end', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await db.collection('sessions').findOne({ id: sessionId });
    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }

    if (session.student_id !== req.user.id) {
      return res.status(403).json({ detail: 'Access denied' });
    }

    await db.collection('sessions').updateOne(
      { id: sessionId },
      { $set: { end_time: new Date(), is_active: false } }
    );

    res.json({ message: 'Session ended successfully' });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log('Socket.IO client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Socket.IO client disconnected:', socket.id);
  });

  socket.on('join_room', async (data) => {
    const { room_id, session_id } = data;
    
    if (room_id && session_id) {
      const session = await db.collection('sessions').findOne({ 
        id: session_id, 
        room_id: room_id 
      });
      
      if (!session) {
        socket.emit('error', { message: 'Invalid session or room' });
        return;
      }

      socket.join(`room_${room_id}`);
      socket.emit('joined_room', { room_id, session_id });
      console.log(`Client ${socket.id} joined room_${room_id}`);
    }
  });

  socket.on('metric', async (data) => {
    const { session_id, room_id } = data;
    
    if (!session_id || !room_id) {
      socket.emit('error', { message: 'Missing session_id or room_id' });
      return;
    }

    const session = await db.collection('sessions').findOne({ 
      id: session_id, 
      room_id: room_id 
    });
    
    if (!session) {
      socket.emit('error', { message: 'Invalid session' });
      return;
    }

    const metric = {
      session_id,
      timestamp: data.timestamp || Date.now() / 1000,
      face_present: data.facePresent || false,
      face_area_ratio: data.faceAreaRatio || 0.0,
      gaze_on_screen: data.gazeOnScreen || 0.0,
      attention_score: data.attentionScore || 0.0,
      engagement_score: data.engagementScore || 0.0,
      blink_rate: data.blinkRate || 0.0,
      head_pose: data.headPose || {},
      gaze_direction: data.gazeDirection || {},
      fatigue_level: data.fatigueLevel || 0.0
    };

    await db.collection('metrics').insertOne(metric);

    io.to(`room_${room_id}`).emit('student_update', {
      session_id,
      metrics: metric,
      timestamp: new Date().toISOString()
    });
  });
});

// Start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
});.length
        : 0;

      recentSessions.push({
        date: session.start_time,
        subject: room ? room.subject : 'Unknown',
        duration: Math.round(duration),
        avgAttention: Math.round(sessionAttention),
        avgFatigue: Math.round(sessionFatigue)
      });
    }

    res.json({
      totalStudyTime: Math.round(totalStudyTime),
      averageAttention: Math.round(avgAttention),
      averageFatigue: Math.round(avgFatigue),
      totalSessions: sessions.length,
      recentSessions,
      subjectStats: [],
      attentionTrend: [],
      alerts: [],
      dailyStats: [],
      goals: {
        dailyTarget: 180,
        weeklyTarget: 1260,
        targetAttention: 75
      },
      achievements: [
        { title: 'Study Streak', description: '7 days in a row!', icon: '🔥', earned: true },
        { title: 'Focus Master', description: 'Maintained 80%+ attention for 1 hour', icon: '🎯', earned: false },
        { title: 'Early Bird', description: 'Studied before 8 AM', icon: '🌅', earned: false },
        { title: 'Night Owl', description: 'Studied after 10 PM', icon: '🦉', earned: false }
      ]
    });
  } catch (error) {
    console.error('Get student progress error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Student progress endpoint
app.get('/api/students/progress', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const studentId = req.user.id;

    // Calculate date range
    const now = new Date();
    let startDate;
    
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(0);
    }

    // Get student's sessions
    const sessions = await db.collection('sessions').find({
      student_id: studentId,
      start_time: { $gte: startDate }
    }).toArray();

    if (sessions.length === 0) {
      return res.json({
        totalStudyTime: 0,
        averageAttention: 0,
        averageFatigue: 0,
        totalSessions: 0,
        recentSessions: [],
        subjectStats: [],
        attentionTrend: [],
        alerts: []
      });
    }

    // Get metrics
    const sessionIds = sessions.map(s => s.id);
    const metrics = await db.collection('metrics').find({ 
      session_id: { $in: sessionIds } 
    }).toArray();

    // Calculate statistics
    let totalStudyTime = 0;
    const attentionScores = [];
    const fatigueScores = [];

    sessions.forEach(session => {
      if (session.end_time) {
        const duration = (new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60);
        totalStudyTime += duration;
      }
    });

    metrics.forEach(metric => {
      if (metric.attention_score != null) attentionScores.push(metric.attention_score);
      if (metric.fatigue_level != null) fatigueScores.push(metric.fatigue_level);
    });

    const avgAttention = attentionScores.length > 0 
      ? attentionScores.reduce((a, b) => a + b, 0) / attentionScores.length 
      : 0;
    
    const avgFatigue = fatigueScores.length > 0 
      ? fatigueScores.reduce((a, b) => a + b, 0) / fatigueScores.length 
      : 0;

    // Recent sessions with room info
    const recentSessions = [];
    const sortedSessions = sessions.sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).slice(0, 10);
    
    for (let session of sortedSessions) {
      const room = await db.collection('rooms').findOne({ id: session.room_id });
      const duration = session.end_time 
        ? (new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60)
        : 0;
      
      const sessionMetrics = metrics.filter(m => m.session_id === session.id);
      const sessionAttention = sessionMetrics.length > 0
        ? sessionMetrics.reduce((sum, m) => sum + (m.attention_score || 0), 0) / sessionMetrics.length
        : 0;
      const sessionFatigue = sessionMetrics.length > 0
        ? sessionMetrics.reduce((sum, m) => sum + (m.fatigue_level || 0), 0) / sessionMetrics