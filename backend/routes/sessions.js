const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get session details
router.get('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await req.db.collection('sessions').findOne({ id: sessionId });

    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }

    if (session.student_id !== req.user.id && req.user.role !== 'teacher') {
      return res.status(403).json({ detail: 'Access denied' });
    }

    if (req.user.role === 'teacher') {
      const room = await req.db.collection('rooms').findOne({
        id: session.room_id,
        teacher_id: req.user.id,
      });

      if (!room) {
        return res.status(403).json({ detail: 'Access denied' });
      }
    }

    const room = await req.db.collection('rooms').findOne({ id: session.room_id });

    const metrics = await req.db.collection('metrics').find({
      session_id: sessionId,
    }).toArray();

    const response = {
      id: session.id,
      room_id: session.room_id,
      room: {
        id: room.id,
        title: room.title,
        subject: room.subject,
        description: room.description,
        has_pdf: room.pdf_file ? true : false,
      },
      start_time: session.start_time,
      end_time: session.end_time,
      is_active: session.is_active,
      consent: session.consent,
      metrics: metrics.length > 0 ? metrics : [],
    };

    delete response._id;
    console.log(`✓ Fetched session ${sessionId}`);
    res.json(response);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Update session consent (student only)
router.put('/:sessionId/consent', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { consent } = req.body;

    if (typeof consent !== 'boolean') {
      return res.status(400).json({ detail: 'Consent must be a boolean' });
    }

    const session = await req.db.collection('sessions').findOne({
      id: sessionId,
      student_id: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }

    await req.db.collection('sessions').updateOne(
      { id: sessionId },
      { $set: { consent, updated_at: new Date() } }
    );

    console.log(`✓ Consent updated for session ${sessionId}`);
    res.json({ message: 'Consent updated successfully' });
  } catch (error) {
    console.error('Update consent error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// End a session (student only)
router.post('/:sessionId/end', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await req.db.collection('sessions').findOne({
      id: sessionId,
      student_id: req.user.id,
    });

    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }

    if (!session.is_active) {
      return res.status(400).json({ detail: 'Session already ended' });
    }

    await req.db.collection('sessions').updateOne(
      { id: sessionId },
      { $set: { end_time: new Date(), is_active: false, updated_at: new Date() } }
    );

    console.log(`✓ Session ended: ${sessionId}`);
    res.json({ message: 'Session ended successfully' });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;