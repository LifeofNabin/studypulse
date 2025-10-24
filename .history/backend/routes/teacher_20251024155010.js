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

// Get all students (teacher only)
router.get('/students', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const students = await req.db.collection('users').find({ role: 'student' }).toArray();
    const studentData = students.map((student) => ({
      id: student.id,
      name: student.name,
      email: student.email,
      class: student.class || 'N/A',
      created_at: student.created_at,
    }));

    console.log(`✓ Fetched ${studentData.length} students for teacher ${req.user.id}`);
    res.json(studentData);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get rooms (teacher only)
router.get('/rooms', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const rooms = await req.db.collection('rooms').find({ teacher_id: req.user.id }).toArray();

    for (let room of rooms) {
      const activeSessionsCount = await req.db.collection('sessions').countDocuments({
        room_id: room.id,
        is_active: true,
      });

      room.students_count = room.allowed_students ? room.allowed_students.length : 0;
      room.status = room.is_active ? 'active' : 'inactive';

      if (room.pdf_file) {
        room.pdf_file = {
          name: room.pdf_file.name,
          uploaded_at: room.pdf_file.uploaded_at,
        };
      }

      room.allowed_students = room.allowed_students || [];
      delete room._id;
    }

    console.log(`✓ Fetched ${rooms.length} rooms for teacher ${req.user.id}`);
    res.json(rooms);
  } catch (error) {
    console.error('Get teacher rooms error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Create a room (teacher only)
router.post('/rooms', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { title, subject, description, duration = 60, allowedStudents = [] } = req.body;

    if (!title || !subject) {
      return res.status(400).json({ detail: 'Title and subject are required' });
    }

    if (allowedStudents.length > 0) {
      const students = await req.db.collection('users').find({
        id: { $in: allowedStudents },
        role: 'student',
      }).toArray();

      if (students.length !== allowedStudents.length) {
        return res.status(400).json({ detail: 'Some selected students are invalid' });
      }
    }

    const room = {
      id: uuidv4(),
      title,
      subject,
      description,
      teacher_id: req.user.id,
      room_code: uuidv4().slice(0, 8).toUpperCase(),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      duration,
      allowed_students: allowedStudents,
      students_count: allowedStudents.length,
      status: 'active',
    };

    await req.db.collection('rooms').insertOne(room);
    delete room._id;

    console.log(`✓ Room created: ${room.title} with ${allowedStudents.length} students`);
    res.json(room);
  } catch (error) {
    console.error('Create teacher room error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Add student to room (teacher only)
router.post('/rooms/:roomId/add-student', authenticateToken, requireRole('teacher'), async (req, res) => {
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

    const allowedStudents = room.allowed_students || [];
    if (allowedStudents.includes(student_id)) {
      return res.status(400).json({ detail: 'Student already enrolled in this room' });
    }

    allowedStudents.push(student_id);

    await req.db.collection('rooms').updateOne(
      { id: roomId },
      {
        $set: {
          allowed_students: allowedStudents,
          students_count: allowedStudents.length,
          updated_at: new Date(),
        },
      }
    );

    console.log(`✓ Student ${student.name} added to room ${room.title}`);
    res.json({
      success: true,
      message: 'Student added successfully',
      room_id: roomId,
      student_id,
      students_count: allowedStudents.length,
    });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ detail: 'Failed to add student' });
  }
});

// Remove student from room (teacher only)
router.delete('/rooms/:roomId/students/:studentId', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { roomId, studentId } = req.params;

    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: req.user.id,
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    const allowedStudents = (room.allowed_students || []).filter((id) => id !== studentId);

    await req.db.collection('rooms').updateOne(
      { id: roomId },
      {
        $set: {
          allowed_students: allowedStudents,
          students_count: allowedStudents.length,
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

    console.log(`✓ Student ${studentId} removed from room ${room.title}`);
    res.json({
      success: true,
      message: 'Student removed successfully',
      students_count: allowedStudents.length,
    });
  } catch (error) {
    console.error('Remove student error:', error);
    res.status(500).json({ detail: 'Failed to remove student' });
  }
});

// Upload PDF to a room (teacher only)
router.post('/rooms/:roomId/upload-pdf', authenticateToken, requireRole('teacher'), upload.single('pdf'), async (req, res) => {
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
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      uploaded_at: new Date(),
    };

    await req.db.collection('rooms').updateOne(
      { id: roomId },
      { $set: { pdf_file: pdfInfo, updated_at: new Date() } }
    );

    console.log(`✓ PDF uploaded to room: ${room.title}`);
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
router.delete('/rooms/:roomId/pdf', authenticateToken, requireRole('teacher'), async (req, res) => {
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
      { $unset: { pdf_file: '' }, $set: { updated_at: new Date() } }
    );

    console.log(`✓ PDF removed from room: ${room.title}`);
    res.json({ message: 'PDF removed successfully' });
  } catch (error) {
    console.error('Remove PDF error:', error);
    res.status(500).json({ detail: 'Failed to remove PDF' });
  }
});

module.exports = router;