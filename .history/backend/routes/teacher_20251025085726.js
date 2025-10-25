// backend/routes/teacher.js
const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// All teacher routes require authentication and teacher role
router.use(authenticateToken);
router.use(requireRole('teacher'));

// ----------------- GET ALL ROOMS -----------------
router.get('/rooms', async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    const rooms = await req.db.collection('rooms')
      .find({ teacher_id: teacherId })
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
      title,
      description: description || '',
      subject: subject || '',
      teacher_id: req.user.id,
      room_code: generateRoomCode(),
      allowed_students: [],
      students_count: 0,
      is_active: true,
      status: 'active',
      duration: expected_duration,
      created_at: new Date(),
      updated_at: new Date()
    };

    await req.db.collection('rooms').insertOne(room);
    delete room._id;

    console.log(`✓ Room created: ${title} (${room.room_code}) by ${req.user.email}`);
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
      teacher_id: teacherId 
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

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
      updated_at: new Date()
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (subject !== undefined) updateData.subject = subject;
    if (is_active !== undefined) {
      updateData.is_active = is_active;
      updateData.status = is_active ? 'active' : 'inactive';
    }

    const result = await req.db.collection('rooms').findOneAndUpdate(
      { id: roomId, teacher_id: teacherId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ detail: 'Room not found' });
    }

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
      teacher_id: teacherId 
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

    // Get all rooms for this teacher
    const rooms = await req.db.collection('rooms')
      .find({ teacher_id: teacherId })
      .toArray();

    // Collect all unique student IDs from all rooms
    const studentIds = new Set();
    rooms.forEach(room => {
      if (room.allowed_students && Array.isArray(room.allowed_students)) {
        room.allowed_students.forEach(studentId => studentIds.add(studentId));
      }
    });

    if (studentIds.size === 0) {
      return res.json([]);
    }

    // Fetch student details
    const students = await req.db.collection('users')
      .find({ 
        id: { $in: Array.from(studentIds) },
        role: 'student'
      })
      .project({ password: 0 }) // Exclude password
      .toArray();

    console.log(`✓ Fetched ${students.length} students for teacher: ${req.user.email}`);
    res.json(students);
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
      teacher_id: teacherId 
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    if (!room.allowed_students || room.allowed_students.length === 0) {
      return res.json([]);
    }

    // Fetch student details
    const students = await req.db.collection('users')
      .find({ 
        id: { $in: room.allowed_students },
        role: 'student'
      })
      .project({ password: 0 })
      .toArray();

    res.json(students);
  } catch (error) {
    console.error('Error fetching room students:', error);
    res.status(500).json({ detail: 'Failed to fetch students' });
  }
});

// ----------------- GET STUDENT STATISTICS -----------------
router.get('/students/stats', async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Get all rooms for this teacher
    const rooms = await req.db.collection('rooms')
      .find({ teacher_id: teacherId })
      .toArray();

    const totalRooms = rooms.length;
    
    // Count unique students across all rooms
    const studentIds = new Set();
    rooms.forEach(room => {
      if (room.allowed_students && Array.isArray(room.allowed_students)) {
        room.allowed_students.forEach(studentId => studentIds.add(studentId));
      }
    });

    const totalStudents = studentIds.size;

    // Get total study sessions
    const studySessions = await req.db.collection('sessions')
      .countDocuments({ 
        room_id: { $in: rooms.map(r => r.id) }
      });

    const stats = {
      totalRooms,
      totalStudents,
      totalStudySessions: studySessions,
      activeRooms: rooms.filter(r => r.is_active).length
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

    if (!student_id) {
      return res.status(400).json({ detail: 'Student ID is required' });
    }

    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: teacherId,
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

// ----------------- REMOVE STUDENT FROM ROOM -----------------
router.delete('/rooms/:roomId/students/:studentId', async (req, res) => {
  try {
    const { roomId, studentId } = req.params;
    const teacherId = req.user.id;

    const room = await req.db.collection('rooms').findOne({
      id: roomId,
      teacher_id: teacherId,
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

    // End any active sessions for this student in this room
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

    console.log(`✓ Student ${studentId} removed from room ${roomId}`);
    res.json({ 
      message: 'Student removed successfully',
      students_count: allowedStudents.length 
    });
  } catch (error) {
    console.error('Error removing student:', error);
    res.status(500).json({ detail: 'Failed to remove student' });
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