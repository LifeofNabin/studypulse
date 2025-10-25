// backend/routes/student.js
const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All student routes require authentication and student role
router.use(authenticateToken);
router.use(requireRole('student'));

// ----------------- JOIN ROOM WITH CODE -----------------
router.post('/rooms/join', async (req, res) => {
  try {
    const { roomCode } = req.body;
    const studentId = req.user.id;

    if (!roomCode) {
      return res.status(400).json({ detail: 'Room code is required' });
    }

    // Find room by code
    const room = await req.db.collection('rooms').findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found or inactive' });
    }

    // Check if already joined
    if (room.students && room.students.includes(studentId)) {
      return res.status(400).json({ detail: 'Already joined this room' });
    }

    // Add student to room
    await req.db.collection('rooms').updateOne(
      { id: room.id },
      { 
        $push: { students: studentId },
        $set: { updated_at: new Date() }
      }
    );

    console.log(`✓ Student ${req.user.email} joined room: ${room.name}`);
    res.json({ 
      message: 'Successfully joined room',
      room: { ...room, students: [...(room.students || []), studentId] }
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ detail: 'Failed to join room' });
  }
});

// ----------------- GET MY ROOMS -----------------
router.get('/rooms', async (req, res) => {
  try {
    const studentId = req.user.id;

    const rooms = await req.db.collection('rooms')
      .find({ 
        students: studentId,
        isActive: true
      })
      .sort({ updated_at: -1 })
      .toArray();

    console.log(`✓ Fetched ${rooms.length} rooms for student: ${req.user.email}`);
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ detail: 'Failed to fetch rooms' });
  }
});

// ----------------- LEAVE ROOM -----------------
router.post('/rooms/:roomId/leave', async (req, res) => {
  try {
    const { roomId } = req.params;
    const studentId = req.user.id;

    const result = await req.db.collection('rooms').updateOne(
      { id: roomId, students: studentId },
      { 
        $pull: { students: studentId },
        $set: { updated_at: new Date() }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ detail: 'Room not found or not a member' });
    }

    console.log(`✓ Student ${req.user.email} left room: ${roomId}`);
    res.json({ message: 'Successfully left room' });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ detail: 'Failed to leave room' });
  }
});

// ----------------- GET ROOM DETAILS -----------------
router.get('/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const studentId = req.user.id;

    const room = await req.db.collection('rooms').findOne({ 
      id: roomId,
      students: studentId,
      isActive: true
    });

    if (!room) {
      return res.status(404).json({ detail: 'Room not found or access denied' });
    }

    res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ detail: 'Failed to fetch room' });
  }
});

module.exports = router;