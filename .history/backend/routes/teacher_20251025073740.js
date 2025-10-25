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
      .find({ teacherId })
      .sort({ created_at: -1 })
      .toArray();

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
    const { name, description, subject } = req.body;
    
    if (!name) {
      return res.status(400).json({ detail: 'Room name is required' });
    }

    const room = {
      id: uuidv4(),
      name,
      description: description || '',
      subject: subject || '',
      teacherId: req.user.id,
      teacherName: req.user.name,
      roomCode: generateRoomCode(),
      students: [],
      created_at: new Date(),
      updated_at: new Date(),
      isActive: true
    };

    await req.db.collection('rooms').insertOne(room);

    console.log(`✓ Room created: ${name} by ${req.user.email}`);
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
      teacherId 
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

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
    const { name, description, subject, isActive } = req.body;
    const teacherId = req.user.id;

    const updateData = {
      updated_at: new Date()
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (subject !== undefined) updateData.subject = subject;
    if (isActive !== undefined) updateData.isActive = isActive;

    const result = await req.db.collection('rooms').findOneAndUpdate(
      { id: roomId, teacherId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ detail: 'Room not found' });
    }

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
      teacherId 
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
      .find({ teacherId })
      .toArray();

    // Collect all unique student IDs from all rooms
    const studentIds = new Set();
    rooms.forEach(room => {
      if (room.students && Array.isArray(room.students)) {
        room.students.forEach(studentId => studentIds.add(studentId));
      }
    });

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
      teacherId 
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    if (!room.students || room.students.length === 0) {
      return res.json([]);
    }

    // Fetch student details
    const students = await req.db.collection('users')
      .find({ 
        id: { $in: room.students },
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
      .find({ teacherId })
      .toArray();

    const totalRooms = rooms.length;
    
    // Count unique students across all rooms
    const studentIds = new Set();
    rooms.forEach(room => {
      if (room.students && Array.isArray(room.students)) {
        room.students.forEach(studentId => studentIds.add(studentId));
      }
    });

    const totalStudents = studentIds.size;

    // Get total study sessions (you can customize this based on your schema)
    const studySessions = await req.db.collection('study_sessions')
      .countDocuments({ teacherId });

    const stats = {
      totalRooms,
      totalStudents,
      totalStudySessions: studySessions,
      activeRooms: rooms.filter(r => r.isActive).length
    };

    console.log(`✓ Fetched stats for teacher: ${req.user.email}`, stats);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({ detail: 'Failed to fetch statistics' });
  }
});

// ----------------- REMOVE STUDENT FROM ROOM -----------------
router.delete('/rooms/:roomId/students/:studentId', async (req, res) => {
  try {
    const { roomId, studentId } = req.params;
    const teacherId = req.user.id;

    const result = await req.db.collection('rooms').updateOne(
      { id: roomId, teacherId },
      { $pull: { students: studentId } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ detail: 'Room not found' });
    }

    console.log(`✓ Student removed from room: ${studentId} from ${roomId}`);
    res.json({ message: 'Student removed successfully' });
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