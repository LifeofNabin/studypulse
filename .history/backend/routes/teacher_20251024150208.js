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
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

router.get('/students', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const students = await req.db.collection('users').find({ role: 'student' }).toArray();
    res.json(
      students.map((student) => ({
        id: student.id,
        name: student.name,
        email: student.email,
        class: student.class || 'N/A',
        created_at: student.created_at,
      }))
    );
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

router.get('/students/:studentId/sessions', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await req.db.collection('users').findOne({ id: studentId, role: 'student' });
    if (!student) {
      return res.status(404).json({ detail: 'Student not found' });
    }

    const sessions = await req.db.collection('sessions').find({ student_id: studentId }).toArray();
    const rooms = await req.db.collection('rooms').find({}).toArray();
    const sessionsWithRoomData = sessions.map((session) => {
      const room = rooms.find((r) => r.id === session.room_id);
      return {
        ...session,
        room_title: room?.title || 'Unknown',
        room_subject: room?.subject || 'Unknown',
      };
    });

    res.json(sessionsWithRoomData);
  } catch (error) {
    console.error('Error fetching student sessions:', error);
    res.status(500).json({ detail: 'Failed to fetch sessions' });
  }
});

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

    res.json(rooms);
  } catch (error) {
    console.error('Get teacher rooms error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

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
    console.error('Error adding student:', error);
    res.status(500).json({ detail: 'Failed to add student' });
  }
});

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
        },
      }
    );

    console.log(`✓ Student removed from room ${room.title}`);

    res.json({
      success: true,
      message: 'Student removed successfully',
      students_count: allowedStudents.length,
    });
  } catch (error) {
    console.error('Error removing student:', error);
    res.status(500).json({ detail: 'Failed to remove student' });
  }
});

router.get('/rooms/:roomId/students', authenticateToken, requireRole('teacher'), async (req, res) => {
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

    const studentsInfo = students.map((student) => ({
      id: student.id,
      name: student.name,
      email: student.email,
      class: student.class || '10th Grade',
      created_at: student.created_at,
    }));

    res.json(studentsInfo);
  } catch (error) {
    console.error('Error fetching room students:', error);
    res.status(500).json({ detail: 'Failed to fetch students' });
  }
});

router.delete('/rooms/:roomId', authenticateToken, requireRole('teacher'), async (req, res) => {
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
      } catch (err) {
        console.log('PDF file not found or already deleted');
      }
    }

    await req.db.collection('sessions').updateMany(
      { room_id: roomId, is_active: true },
      { $set: { is_active: false, end_time: new Date() } }
    );

    await req.db.collection('rooms').deleteOne({ id: roomId });

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

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
      } catch (err) {
        console.log('Old PDF file not found or already deleted');
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
      { $set: { pdf_file: pdfInfo } }
    );

    console.log(`✓ PDF uploaded to room: ${room.title}`);

    res.json({
      message: 'PDF uploaded successfully',
      pdf_file: {
        name: pdfInfo.name,
        uploaded_at: pdfInfo.updated_at,
      },
    });
  } catch (error) {
    console.error('Upload PDF error:', error);
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.log('Failed to delete uploaded file');
      }
    }
    res.status(500).json({ detail: 'Failed to upload PDF' });
  }
});

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
    } catch (err) {
      console.log('PDF file not found on disk, removing from database anyway');
    }

    await req.db.collection('rooms').updateOne(
      { id: roomId },
      { $unset: { pdf_file: '' } }
    );

    res.json({ message: 'PDF removed successfully' });
  } catch (error) {
    console.error('Remove PDF error:', error);
    res.status(500).json({ detail: 'Failed to remove PDF' });
  }
});

module.exports = router;