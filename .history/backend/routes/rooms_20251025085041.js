// /Users/nabin/studypulse/backend/routes/rooms.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for PDF uploads (for consistency, though handled in teacher.js)
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'Uploads', 'pdfs');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// Get all rooms (filtered by user role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'teacher') {
      query = { teacher_id: req.user.id };
    } else {
      query = { is_active: true, allowed_students: req.user.id };
    }

    const rooms = await req.db.collection('rooms').find(query).toArray();

    for (let room of rooms) {
      room.students_count = room.allowed_students?.length || 0;
      room.status = room.is_active ? 'active' : 'inactive';
      room.has_pdf = !!room.pdf_file;
      delete room._id;
    }

    console.log(`✓ Fetched ${rooms.length} rooms for ${req.user.role} ${req.user.id}`);
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
      teacher_id: req.user.id,
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    const sessions = await req.db.collection('sessions').find({
      room_id: roomId,
      is_active: true,
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
          is_active: session.is_active,
        };
      })
    );

    console.log(`✓ Fetched ${sessionsWithStudents.length} active sessions for room ${roomId}`);
    res.json(sessionsWithStudents);
  } catch (error) {
    console.error('Get room sessions error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Create a room (teacher only)
router.post('/', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { title, subject, description, duration = 60, allowed_students = [] } = req.body;

    if (!title || !subject) {
      return res.status(400).json({ detail: 'Title and subject are required' });
    }

    if (allowed_students.length > 0) {
      const students = await req.db.collection('users').find({
        id: { $in: allowed_students },
        role: 'student',
      }).toArray();

      if (students.length !== allowed_students.length) {
        return res.status(400).json({ detail: 'Some selected students are invalid' });
      }
    }

    const room = {
      id: uuidv4(),
      title,
      subject,
      description: description || '',
      teacher_id: req.user.id,
      teacher_name: req.user.name,
      room_code: generateRoomCode(),
      is_active: true,
      status: 'active',
      duration,
      allowed_students,
      students_count: allowed_students.length,
      created_at: new Date(),
      updated_at: new Date(),
      pdf_file: null,
    };

    await req.db.collection('rooms').insertOne(room);
    delete room._id;

    console.log(`✓ Room created: ${room.title} with ${allowed_students.length} students by ${req.user.email}`);
    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ detail: 'Failed to create room' });
  }
});

// Join a room using room code (student only)
router.post('/join', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { room_code } = req.body;
    console.log('🚪 Join attempt:', { room_code, user: { id: req.user.id, role: req.user.role } });

    if (!room_code) {
      return res.status(400).json({ detail: 'Room code is required' });
    }

    const room = await req.db.collection('rooms').findOne({
      room_code: room_code,
      is_active: true,
    });

    if (!room) {
      console.log(`❌ Room not found or inactive: ${room_code}`);
      return res.status(404).json({ detail: 'Room not found or inactive' });
    }

    const existingSession = await req.db.collection('sessions').findOne({
      room_id: room.id,
      student_id: req.user.id,
      is_active: true,
    });

    if (existingSession) {
      console.log(`ℹ️ Student ${req.user.id} already in session for room ${room.id}`);
      return res.json({
        message: 'Already in session',
        session_id: existingSession.id,
        room: {
          id: room.id,
          title: room.title,
          subject: room.subject,
          description: room.description,
          teacher_id: room.teacher_id,
          teacher_name: room.teacher_name,
          room_code: room.room_code,
          has_pdf: !!room.pdf_file,
          status: room.is_active ? 'active' : 'inactive',
          students_count: room.allowed_students?.length || 0,
        },
      });
    }

    const session = {
      id: uuidv4(),
      room_id: room.id,
      student_id: req.user.id,
      start_time: new Date(),
      end_time: null,
      is_active: true,
      consent: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await req.db.collection('sessions').insertOne(session);

    if (!room.allowed_students.includes(req.user.id)) {
      await req.db.collection('rooms').updateOne(
        { id: room.id },
        {
          $push: { allowed_students: req.user.id },
          $set: {
            students_count: (room.allowed_students?.length || 0) + 1,
            updated_at: new Date(),
          },
        }
      );
    }

    console.log(`✓ Student ${req.user.id} joined room: ${room.title}`);
    res.json({
      message: 'Joined room successfully',
      session_id: session.id,
      room: {
        id: room.id,
        title: room.title,
        subject: room.subject,
        description: room.description,
        teacher_id: room.teacher_id,
        teacher_name: room.teacher_name,
        room_code: room.room_code,
        has_pdf: !!room.pdf_file,
        status: room.is_active ? 'active' : 'inactive',
        students_count: (room.allowed_students?.length || 0) + 1,
      },
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ detail: 'Failed to join room' });
  }
});

// Add student to room (teacher only)
router.post('/:roomId/add-student', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({ detail: 'Student ID is required' });
    }

    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: req.user.id,
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    const student = await req.db.collection('users').findOne({
      id: student_id,
      role: 'student',
    });

    if (!student) {
      return res.status(404).json({ detail: 'Student not found' });
    }

    if (room.allowed_students.includes(student_id)) {
      return res.status(400).json({ detail: 'Student already enrolled in this room' });
    }

    await req.db.collection('rooms').updateOne(
      { id: roomId },
      {
        $push: { allowed_students: student_id },
        $set: {
          students_count: (room.allowed_students?.length || 0) + 1,
          updated_at: new Date(),
        },
      }
    );

    console.log(`✓ Student ${student_id} added to room ${room.title} by ${req.user.email}`);
    res.json({
      success: true,
      message: 'Student added successfully',
      room_id: roomId,
      student_id,
      students_count: (room.allowed_students?.length || 0) + 1,
    });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ detail: 'Failed to add student' });
  }
});

// Remove student from room (teacher only)
router.delete('/:roomId/students/:studentId', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { roomId, studentId } = req.params;

    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: req.user.id,
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    if (!room.allowed_students.includes(studentId)) {
      return res.status(400).json({ detail: 'Student not enrolled in this room' });
    }

    await req.db.collection('rooms').updateOne(
      { id: roomId },
      {
        $pull: { allowed_students: studentId },
        $set: {
          students_count: (room.allowed_students?.length || 0) - 1,
          updated_at: new Date(),
        },
      }
    );

    await req.db.collection('sessions').updateMany(
      {
        room_id: roomId,
        student_id: studentId,
        is_active: true,
      },
      {
        $set: {
          is_active: false,
          end_time: new Date(),
          updated_at: new Date(),
        },
      }
    );

    console.log(`✓ Student ${studentId} removed from room ${room.title} by ${req.user.email}`);
    res.json({
      success: true,
      message: 'Student removed successfully',
      students_count: (room.allowed_students?.length || 0) - 1,
    });
  } catch (error) {
    console.error('Remove student error:', error);
    res.status(500).json({ detail: 'Failed to remove student' });
  }
});

// Get students in a room (teacher only)
router.get('/:roomId/students', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: req.user.id,
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    const allowedStudents = room.allowed_students || [];

    if (allowedStudents.length === 0) {
      return res.json([]);
    }

    const students = await req.db.collection('users').find({
      id: { $in: allowedStudents },
      role: 'student',
    }).toArray();

    const studentsInfo = await Promise.all(
      students.map(async (student) => {
        const sessions = await req.db.collection('sessions').find({ student_id: student.id, room_id: roomId }).toArray();
        const totalSessions = sessions.length;
        const avgAttention = sessions.length
          ? Math.round(sessions.reduce((sum, s) => sum + (s.attention_score || 0), 0) / sessions.length)
          : 0;
        return {
          id: student.id,
          name: student.name,
          email: student.email,
          class: student.class || 'N/A',
          total_sessions: totalSessions,
          avg_attention: avgAttention,
          last_session: sessions.length ? sessions[sessions.length - 1].created_at : null,
        };
      })
    );

    console.log(`✓ Fetched ${studentsInfo.length} students for room ${roomId}`);
    res.json(studentsInfo);
  } catch (error) {
    console.error('Get room students error:', error);
    res.status(500).json({ detail: 'Failed to fetch students' });
  }
});

// Delete a room (teacher only)
router.delete('/:roomId', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: req.user.id,
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    if (room.pdf_file && room.pdf_file.path) {
      try {
        await fs.unlink(room.pdf_file.path);
        console.log(`✓ Deleted PDF file for room ${room.title}`);
      } catch (err) {
        console.log('PDF file not found or already deleted:', err.message);
      }
    }

    await req.db.collection('sessions').updateMany(
      { room_id: roomId, is_active: true },
      { $set: { is_active: false, end_time: new Date(), updated_at: new Date() } }
    );

    await req.db.collection('rooms').deleteOne({ id: roomId });

    console.log(`✓ Room deleted: ${room.title} by ${req.user.email}`);
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ detail: 'Failed to delete room' });
  }
});

// Upload PDF to a room (teacher only)
router.post('/:roomId/upload-pdf', authenticateToken, requireRole('teacher'), upload.single('pdf'), async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!req.file) {
      return res.status(400).json({ detail: 'No PDF file provided' });
    }

    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: req.user.id,
    });

    if (!room) {
      await fs.unlink(req.file.path);
      return res.status(404).json({ detail: 'Room not found' });
    }

    if (room.pdf_file && room.pdf_file.path) {
      try {
        await fs.unlink(room.pdf_file.path);
        console.log(`✓ Deleted old PDF for room ${room.title}`);
      } catch (err) {
        console.log('Old PDF file not found or already deleted:', err.message);
      }
    }

    const pdfInfo = {
      name: req.file.originalname,
      path: req.file.path,
      uploaded_at: new Date(),
    };

    await req.db.collection('rooms').updateOne(
      { id: roomId },
      { $set: { pdf_file: pdfInfo, updated_at: new Date() } }
    );

    console.log(`✓ PDF uploaded to room: ${room.title} by ${req.user.email}`);
    res.json({
      message: 'PDF uploaded successfully',
      pdf_file: {
        name: pdfInfo.name,
        uploaded_at: pdfInfo.uploaded_at,
      },
    });
  } catch (error) {
    console.error('Upload PDF error:', error);
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
        console.log('✓ Cleaned up uploaded file after error');
      } catch (err) {
        console.log('Failed to delete uploaded file:', err.message);
      }
    }
    res.status(500).json({ detail: 'Failed to upload PDF' });
  }
});

// Delete PDF from a room (teacher only)
router.delete('/:roomId/pdf', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: req.user.id,
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    if (!room.pdf_file) {
      return res.status(404).json({ detail: 'No PDF file found' });
    }

    try {
      await fs.unlink(room.pdf_file.path);
      console.log(`✓ Deleted PDF file for room ${room.title}`);
    } catch (err) {
      console.log('PDF file not found on disk, removing from database anyway:', err.message);
    }

    await req.db.collection('rooms').updateOne(
      { id: roomId },
      { $set: { pdf_file: null, updated_at: new Date() } }
    );

    console.log(`✓ PDF removed from room: ${room.title} by ${req.user.email}`);
    res.json({ message: 'PDF removed successfully' });
  } catch (error) {
    console.error('Remove PDF error:', error);
    res.status(500).json({ detail: 'Failed to remove PDF' });
  }
});

// Download PDF (student only)
router.get('/:roomId/pdf/download', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { roomId } = req.params;
    console.log('📄 PDF download requested for room:', roomId, 'by user:', req.user.id);

    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      allowed_students: req.user.id,
      is_active: true,
    });

    if (!room) {
      console.log('❌ Room not found or student not enrolled');
      return res.status(403).json({ detail: 'You are not authorized to access this room' });
    }

    if (!room.pdf_file || !room.pdf_file.path) {
      console.log('❌ No PDF file configured for room');
      return res.status(404).json({ detail: 'No PDF file available for this room' });
    }

    const pdfPath = room.pdf_file.path;
    console.log('📂 PDF path:', pdfPath);

    try {
      await fs.access(pdfPath);
      const stats = await fs.stat(pdfPath);
      console.log('✅ PDF file exists, size:', stats.size, 'bytes');
    } catch (err) {
      console.error('❌ PDF file not found at path:', pdfPath, 'Error:', err.message);
      return res.status(404).json({ detail: 'PDF file not found on server' });
    }

    console.log('📤 Streaming PDF file to client...');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${room.pdf_file.name || 'document.pdf'}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

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
    console.error('Get PDF download error:', error);
    res.status(500).json({ detail: 'Failed to retrieve PDF file' });
  }
});

// Get PDF info (metadata only)
router.get('/:roomId/pdf-info', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      $or: [
        { teacher_id: req.user.id },
        { allowed_students: req.user.id, is_active: true },
      ],
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    if (!room.pdf_file) {
      return res.json({ has_pdf: false });
    }

    console.log(`✓ Fetched PDF info for room ${roomId} by ${req.user.email}`);
    res.json({
      has_pdf: true,
      name: room.pdf_file.name,
      uploaded_at: room.pdf_file.uploaded_at,
    });
  } catch (error) {
    console.error('Get PDF info error:', error);
    res.status(500).json({ detail: 'Failed to retrieve PDF info' });
  }
});

// Helper function to generate room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = router;