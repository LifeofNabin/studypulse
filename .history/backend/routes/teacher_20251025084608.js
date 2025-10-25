// /Users/nabin/studypulse/backend/routes/teacher.js
const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: './Uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// All teacher routes require authentication and teacher role
router.use(authenticateToken);
router.use(requireRole('teacher'));

// ----------------- GET ALL ROOMS -----------------
router.get('/rooms', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const rooms = await req.db.collection('rooms')
      .find({ teacher_id: teacherId }) // Changed from teacherId
      .sort({ created_at: -1 })
      .toArray();

    // Add room status and students count
    for (let room of rooms) {
      room.status = room.is_active ? 'active' : 'inactive';
      room.students_count = room.allowed_students?.length || 0;
      delete room._id;
    }

    console.log(`✓ Fetched ${rooms.length} rooms for teacher: ${req.user.email}`);
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ detail: 'Failed to fetch rooms' });
  }
});

// ----------------- CREATE ROOM -----------------
router.post('/rooms', async (req, res) => {
  try {
    const { title, subject, description, expected_duration = 60 } = req.body;
    if (!title) {
      return res.status(400).json({ detail: 'Room title is required' });
    }
    if (!subject) {
      return res.status(400).json({ detail: 'Subject is required' });
    }
    const room = {
      id: uuidv4(),
      title, // Changed from name
      description: description || '',
      subject: subject || '',
      teacher_id: req.user.id, // Changed from teacherId
      teacher_name: req.user.name, // Changed from teacherName
      room_code: generateRoomCode(), // Changed from roomCode
      allowed_students: [], // Changed from students
      students_count: 0,
      is_active: true, // Changed from isActive
      status: 'active',
      duration: expected_duration,
      created_at: new Date(),
      updated_at: new Date(),
      pdf_file: null, // Added for PDF support
    };
    await req.db.collection('rooms').insertOne(room);
    delete room._id;
    console.log(`✓ Room created: ${title} by ${req.user.email}`);
    res.status(201).json(room);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ detail: 'Failed to create room' });
  }
});

// ----------------- GET ROOM BY ID -----------------
router.get('/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const teacherId = req.user.id;
    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: teacherId, // Changed from teacherId
    });
    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }
    room.status = room.is_active ? 'active' : 'inactive';
    room.students_count = room.allowed_students?.length || 0;
    delete room._id;
    res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ detail: 'Failed to fetch room' });
  }
});

// ----------------- UPDATE ROOM -----------------
router.put('/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { title, description, subject, is_active } = req.body;
    const teacherId = req.user.id;
    const updateData = {
      updated_at: new Date(),
    };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (subject !== undefined) updateData.subject = subject;
    if (is_active !== undefined) {
      updateData.is_active = is_active;
      updateData.status = is_active ? 'active' : 'inactive';
    }
    const result = await req.db.collection('rooms').findOneAndUpdate(
      { id: roomId, teacher_id: teacherId }, // Changed from teacherId
      { $set: updateData },
      { returnDocument: 'after' }
    );
    if (!result.value) {
      return res.status(404).json({ detail: 'Room not found' });
    }
    result.value.students_count = result.value.allowed_students?.length || 0;
    delete result.value._id;
    console.log(`✓ Room updated: ${roomId}`);
    res.json(result.value);
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ detail: 'Failed to update room' });
  }
});

// ----------------- DELETE ROOM -----------------
router.delete('/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const teacherId = req.user.id;
    const result = await req.db.collection('rooms').deleteOne({
      id: roomId,
      teacher_id: teacherId, // Changed from teacherId
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ detail: 'Room not found' });
    }
    console.log(`✓ Room deleted: ${roomId}`);
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ detail: 'Failed to delete room' });
  }
});

// ----------------- GET ALL STUDENTS (across all rooms) -----------------
router.get('/students', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const rooms = await req.db.collection('rooms')
      .find({ teacher_id: teacherId }) // Changed from teacherId
      .toArray();
    const studentIds = new Set();
    rooms.forEach((room) => {
      if (room.allowed_students && Array.isArray(room.allowed_students)) {
        room.allowed_students.forEach((studentId) => studentIds.add(studentId));
      }
    });
    const students = await req.db.collection('users')
      .find({
        id: { $in: Array.from(studentIds) },
        role: 'student',
      })
      .project({ password: 0 })
      .toArray();
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const sessions = await req.db.collection('study_sessions').find({ userId: student.id }).toArray();
        const totalSessions = sessions.length;
        const avgAttention = sessions.length
          ? Math.round(sessions.reduce((sum, s) => sum + (s.attentionScore || 0), 0) / sessions.length)
          : 0;
        return {
          id: student.id,
          name: student.name,
          email: student.email,
          class: student.class || '',
          total_sessions: totalSessions,
          avg_attention: avgAttention,
          last_session: sessions.length ? sessions[sessions.length - 1].createdAt : null,
        };
      })
    );
    console.log(`✓ Fetched ${studentsWithStats.length} students for teacher: ${req.user.email}`);
    res.json(studentsWithStats);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ detail: 'Failed to fetch students' });
  }
});

// ----------------- GET STUDENTS IN SPECIFIC ROOM -----------------
router.get('/rooms/:roomId/students', async (req, res) => {
  try {
    const { roomId } = req.params;
    const teacherId = req.user.id;
    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: teacherId, // Changed from teacherId
    });
    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }
    if (!room.allowed_students || room.allowed_students.length === 0) {
      return res.json([]);
    }
    const students = await req.db.collection('users')
      .find({
        id: { $in: room.allowed_students },
        role: 'student',
      })
      .project({ password: 0 })
      .toArray();
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const sessions = await req.db.collection('study_sessions').find({ userId: student.id }).toArray();
        const totalSessions = sessions.length;
        const avgAttention = sessions.length
          ? Math.round(sessions.reduce((sum, s) => sum + (s.attentionScore || 0), 0) / sessions.length)
          : 0;
        return {
          id: student.id,
          name: student.name,
          email: student.email,
          class: student.class || '',
          total_sessions: totalSessions,
          avg_attention: avgAttention,
          last_session: sessions.length ? sessions[sessions.length - 1].createdAt : null,
        };
      })
    );
    res.json(studentsWithStats);
  } catch (error) {
    console.error('Error fetching room students:', error);
    res.status(500).json({ detail: 'Failed to fetch students' });
  }
});

// ----------------- GET STUDENT STATISTICS -----------------
router.get('/students/stats', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const rooms = await req.db.collection('rooms')
      .find({ teacher_id: teacherId }) // Changed from teacherId
      .toArray();
    const totalRooms = rooms.length;
    const studentIds = new Set();
    rooms.forEach((room) => {
      if (room.allowed_students && Array.isArray(room.allowed_students)) {
        room.allowed_students.forEach((studentId) => studentIds.add(studentId));
      }
    });
    const totalStudents = studentIds.size;
    const studySessions = await req.db.collection('study_sessions').countDocuments({ teacherId });
    const stats = {
      totalRooms,
      totalStudents,
      totalStudySessions: studySessions,
      activeRooms: rooms.filter((r) => r.is_active).length,
    };
    console.log(`✓ Fetched stats for teacher: ${req.user.email}`, stats);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({ detail: 'Failed to fetch statistics' });
  }
});

// ----------------- ADD STUDENT TO ROOM -----------------
router.post('/rooms/:roomId/add-student', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { student_id } = req.body;
    const teacherId = req.user.id;
    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: teacherId, // Changed from teacherId
    });
    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }
    const student = await req.db.collection('users').findOne({ id: student_id, role: 'student' });
    if (!student) {
      return res.status(404).json({ detail: 'Student not found' });
    }
    if (!room.allowed_students.includes(student_id)) {
      room.allowed_students.push(student_id);
      await req.db.collection('rooms').updateOne(
        { id: roomId, teacher_id: teacherId },
        {
          $set: {
            allowed_students: room.allowed_students,
            students_count: room.allowed_students.length,
            updated_at: new Date(),
          },
        }
      );
    }
    console.log(`✓ Student ${student_id} added to room: ${roomId}`);
    res.json({ message: 'Student added successfully' });
  } catch (error) {
    console.error('Error adding student:', error);
    res.status(500).json({ detail: 'Failed to add student' });
  }
});

// ----------------- REMOVE STUDENT FROM ROOM -----------------
router.delete('/rooms/:roomId/students/:studentId', async (req, res) => {
  try {
    const { roomId, studentId } = req.params;
    const teacherId = req.user.id;
    const result = await req.db.collection('rooms').updateOne(
      { id: roomId, teacher_id: teacherId }, // Changed from teacherId
      {
        $pull: { allowed_students: studentId },
        $set: { updated_at: new Date() },
      }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ detail: 'Room not found' });
    }
    // Update students_count
    const updatedRoom = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: teacherId,
    });
    await req.db.collection('rooms').updateOne(
      { id: roomId, teacher_id: teacherId },
      {
        $set: {
          students_count: updatedRoom.allowed_students?.length || 0,
        },
      }
    );
    console.log(`✓ Student removed from room: ${studentId} from ${roomId}`);
    res.json({ message: 'Student removed successfully' });
  } catch (error) {
    console.error('Error removing student:', error);
    res.status(500).json({ detail: 'Failed to remove student' });
  }
});

// ----------------- UPLOAD PDF -----------------
router.post('/rooms/:roomId/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const teacherId = req.user.id;
    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: teacherId, // Changed from teacherId
    });
    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }
    if (!req.file) {
      return res.status(400).json({ detail: 'No PDF file uploaded' });
    }
    const pdfFile = {
      name: req.file.originalname,
      path: req.file.path,
      uploaded_at: new Date(),
    };
    await req.db.collection('rooms').updateOne(
      { id: roomId, teacher_id: teacherId },
      {
        $set: {
          pdf_file: pdfFile,
          updated_at: new Date(),
        },
      }
    );
    console.log(`✓ PDF uploaded for room: ${roomId}`);
    res.json({ pdf_file: pdfFile });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(400).json({ detail: error.message || 'Failed to upload PDF' });
  }
});

// ----------------- REMOVE PDF -----------------
router.delete('/rooms/:roomId/pdf', async (req, res) => {
  try {
    const { roomId } = req.params;
    const teacherId = req.user.id;
    const result = await req.db.collection('rooms').updateOne(
      { id: roomId, teacher_id: teacherId }, // Changed from teacherId
      {
        $set: {
          pdf_file: null,
          updated_at: new Date(),
        },
      }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ detail: 'Room not found' });
    }
    console.log(`✓ PDF removed from room: ${roomId}`);
    res.json({ message: 'PDF removed successfully' });
  } catch (error) {
    console.error('Error removing PDF:', error);
    res.status(500).json({ detail: 'Failed to remove PDF' });
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