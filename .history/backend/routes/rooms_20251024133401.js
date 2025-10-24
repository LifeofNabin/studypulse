const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'Uploads', 'pdfs');
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

// Get all rooms (filtered by user role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'teacher') {
      query = { teacher_id: req.user.id };
    } else {
      query = { 
        is_active: true,
        allowed_students: req.user.id
      };
    }

    const rooms = await req.db.collection('rooms').find(query).toArray();
    
    for (let room of rooms) {
      const activeSessionsCount = await req.db.collection('sessions').countDocuments({
        room_id: room.id,
        is_active: true
      });
      room.students_count = activeSessionsCount;
      room.status = room.is_active ? 'active' : 'inactive';
      
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

// Get active sessions for a room (teacher only)
router.get('/:roomId/sessions', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await req.db.collection('rooms').findOne({ 
      id: roomId,
      teacher_id: req.user.id 
    });
    
    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    const sessions = await req.db.collection('sessions').find({
      room_id: roomId,
      is_active: true
    }).toArray();

    const sessionsWithStudents = await Promise.all(
      sessions.map(async (session) => {
        const student = await req.db.collection('users').findOne({ id: session.student_id });
        return {
          id: session.id,
          student_id: session.student_id,
          student_name: student ? student.name : 'Unknown',
          student_email: student ? student.email : '',
          start_time: session.start_time,
          is_active: session.is_active
        };
      })
    );

    res.json(sessionsWithStudents);
  } catch (error) {
    console.error('Get room sessions error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Join a room using room code (student only)
router.post('/:roomCode/join', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { roomCode } = req.params;
    console.log('🚪 Join attempt:', { roomCode, user: { id: req.user.id, role: req.user.role } });

    const room = await req.db.collection('rooms').findOne({ 
      room_code: roomCode.toUpperCase(), 
      is_active: true 
    });
    
    if (!room) {
      console.log('❌ Room not found or inactive:', roomCode);
      return res.status(404).json({ detail: 'Room not found or inactive' });
    }
    console.log('✅ Room found:', { id: room.id, title: room.title, is_active: room.is_active });

    // Check if student already has an active session in this room
    const existingSession = await req.db.collection('sessions').findOne({
      room_id: room.id,
      student_id: req.user.id,
      is_active: true
    });

    if (existingSession) {
      console.log('ℹ️ Student already in session');
      return res.json({
        message: 'Already in session',
        session_id: existingSession.id,
        room: {
          id: room.id,
          title: room.title,
          subject: room.subject,
          description: room.description,
          has_pdf: room.pdf_file ? true : false
        }
      });
    }

    // Create new session
    const session = {
      id: uuidv4(),
      room_id: room.id,
      student_id: req.user.id,
      start_time: new Date(),
      end_time: null,
      is_active: true,
      consent: false
    };

    await req.db.collection('sessions').insertOne(session);
    
    // Add student to allowed_students list if not already there
    const allowedStudents = room.allowed_students || [];
    if (!allowedStudents.includes(req.user.id)) {
      allowedStudents.push(req.user.id);
      await req.db.collection('rooms').updateOne(
        { id: room.id },
        { 
          $set: { 
            allowed_students: allowedStudents,
            students_count: allowedStudents.length,
            updated_at: new Date()
          } 
        }
      );
    }

    console.log(`✅ Student ${req.user.name} joined room: ${room.title}`);
    
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
    console.error('❌ Join room error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// ✅ NEW ENDPOINT: Direct PDF download (RECOMMENDED)
router.get('/:roomId/pdf/download', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { roomId } = req.params;
    console.log('📄 PDF download requested for room:', roomId);
    console.log('👤 User:', req.user.id, req.user.name);

    // Verify student has active session in this room
    const session = await req.db.collection('sessions').findOne({
      room_id: roomId,
      student_id: req.user.id,
      is_active: true
    });

    if (!session) {
      console.log('❌ No active session found for student');
      return res.status(403).json({ detail: 'You must join this room first' });
    }
    console.log('✅ Active session found:', session.id);

    // Get room with PDF info
    const room = await req.db.collection('rooms').findOne({ id: roomId });
    
    if (!room) {
      console.log('❌ Room not found');
      return res.status(404).json({ detail: 'Room not found' });
    }
    console.log('✅ Room found:', room.title);

    if (!room.pdf_file || !room.pdf_file.filename) {
      console.log('❌ No PDF file configured for room');
      console.log('Room PDF field:', room.pdf_file);
      return res.status(404).json({ detail: 'No PDF file available for this room' });
    }
    console.log('✅ PDF file configured:', room.pdf_file.filename);

    // Construct full path to PDF file
    const pdfPath = path.join(__dirname, '..', 'Uploads', 'pdfs', room.pdf_file.filename);
    console.log('📂 PDF path:', pdfPath);

    // Check if file exists
    try {
      await fs.access(pdfPath);
      const stats = await fs.stat(pdfPath);
      console.log('✅ PDF file exists, size:', stats.size, 'bytes');
    } catch (err) {
      console.error('❌ PDF file not found at path:', pdfPath);
      console.error('Error:', err.message);
      return res.status(404).json({ detail: 'PDF file not found on server' });
    }

    console.log('📤 Streaming PDF file to client...');

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${room.pdf_file.name || 'document.pdf'}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Stream the file
    const fileStream = require('fs').createReadStream(pdfPath);
    
    fileStream.on('error', (error) => {
      console.error('❌ Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ detail: 'Error streaming PDF file' });
      }
    });

    fileStream.on('end', () => {
      console.log('✅ PDF streaming completed successfully');
    });

    fileStream.pipe(res);
    
  } catch (error) {
    console.error('❌ Get PDF download error:', error);
    res.status(500).json({ detail: 'Failed to retrieve PDF file' });
  }
});

// Get PDF info (URL) - Legacy endpoint for backward compatibility
router.get('/:roomId/pdf', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { roomId } = req.params;

    const session = await req.db.collection('sessions').findOne({
      room_id: roomId,
      student_id: req.user.id,
      is_active: true
    });

    if (!session) {
      return res.status(403).json({ detail: 'You must join this room first' });
    }

    const room = await req.db.collection('rooms').findOne({ id: roomId });
    
    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    if (!room.pdf_file || !room.pdf_file.filename) {
      return res.status(404).json({ detail: 'No PDF file available for this room' });
    }

    // Check if file exists
    const pdfPath = path.join(__dirname, '..', 'Uploads', 'pdfs', room.pdf_file.filename);
    try {
      await fs.access(pdfPath);
    } catch (err) {
      return res.status(404).json({ detail: 'PDF file not found on server' });
    }

    // Return URL to PDF file
    const pdfUrl = `${req.protocol}://${req.get('host')}/Uploads/pdfs/${room.pdf_file.filename}`;
    res.json({ pdfUrl });
  } catch (error) {
    console.error('Get PDF error:', error);
    res.status(500).json({ detail: 'Failed to retrieve PDF URL' });
  }
});

// Get PDF info (metadata only)
router.get('/:roomId/pdf-info', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await req.db.collection('rooms').findOne({ id: roomId });
    
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
});

module.exports = router;