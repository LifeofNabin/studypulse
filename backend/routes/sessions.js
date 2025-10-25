// backend/routes/sessions.js
const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// ============================================
// CREATE SESSION FROM GOAL (NEW)
// ============================================
router.post('/create-from-goal', authenticateToken, async (req, res) => {
  try {
    const { goalId, goalTitle, subjects } = req.body;
    const userId = req.user.id;

    if (!goalTitle || !subjects || subjects.length === 0) {
      return res.status(400).json({ detail: 'Goal title and subjects are required' });
    }

    const sessionId = uuidv4();
    const roomId = uuidv4();

    // Create room for the goal session
    const room = {
      id: roomId,
      title: goalTitle,
      subject: subjects.map(s => s.subject).join(', '),
      description: `Study session for: ${goalTitle}`,
      teacher_id: userId, // Self-study, so student is the owner
      students: [userId],
      room_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      created_at: new Date(),
      is_active: true,
      type: 'goal_session',
      goal_id: goalId,
      subjects: subjects
    };

    // Create session
    const session = {
      id: sessionId,
      room_id: roomId,
      student_id: userId,
      goal_id: goalId,
      goal_title: goalTitle,
      subjects: subjects,
      start_time: new Date(),
      is_active: true,
      consent: true,
      created_at: new Date()
    };

    await req.db.collection('rooms').insertOne(room);
    await req.db.collection('sessions').insertOne(session);

    console.log(`✓ Goal session created: ${goalTitle} for ${req.user.email}`);
    
    res.json({
      session_id: sessionId,
      room_id: roomId,
      message: 'Session created successfully'
    });
  } catch (error) {
    console.error('Create goal session error:', error);
    res.status(500).json({ detail: 'Failed to create session' });
  }
});

// ============================================
// GET SESSION DETAILS
// ============================================
router.get('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await req.db.collection('sessions').findOne({ id: sessionId });
    
    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }

    // Check access permissions
    if (session.student_id !== req.user.id && req.user.role !== 'teacher') {
      return res.status(403).json({ detail: 'Access denied' });
    }

    // If teacher, verify they own the room
    if (req.user.role === 'teacher') {
      const room = await req.db.collection('rooms').findOne({
        id: session.room_id,
        teacher_id: req.user.id,
      });
      if (!room) {
        return res.status(403).json({ detail: 'Access denied' });
      }
    }

    // Get room details
    const room = await req.db.collection('rooms').findOne({ id: session.room_id });
    
    // Get metrics for this session
    const metrics = await req.db.collection('metrics')
      .find({ session_id: sessionId })
      .toArray();

    const response = {
      id: session.id,
      room_id: session.room_id,
      goal_id: session.goal_id,
      goal_title: session.goal_title,
      subjects: session.subjects,
      room: {
        id: room.id,
        title: room.title,
        subject: room.subject,
        description: room.description,
        has_pdf: room.pdf_file ? true : false,
        type: room.type || 'regular'
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

// ============================================
// UPDATE SESSION CONSENT
// ============================================
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

// ============================================
// END SESSION (ENHANCED)
// ============================================
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

    const endTime = new Date();
    const duration = Math.floor((endTime - new Date(session.start_time)) / 1000); // Duration in seconds

    // Get all metrics for this session
    const metrics = await req.db.collection('metrics')
      .find({ session_id: sessionId })
      .sort({ timestamp: 1 })
      .toArray();

    // Calculate aggregate metrics
    let avgAttention = 0;
    let avgFatigue = 0;
    let faceDetectionRate = 0;
    let totalDistractions = 0;
    let peakAttention = 0;
    let lowestAttention = 100;

    if (metrics.length > 0) {
      const validMetrics = metrics.filter(m => 
        typeof m.attentionScore === 'number' && 
        !isNaN(m.attentionScore)
      );

      if (validMetrics.length > 0) {
        avgAttention = validMetrics.reduce((sum, m) => sum + m.attentionScore, 0) / validMetrics.length;
        avgFatigue = validMetrics.reduce((sum, m) => sum + (m.fatigueLevel || 0), 0) / validMetrics.length;
        peakAttention = Math.max(...validMetrics.map(m => m.attentionScore));
        lowestAttention = Math.min(...validMetrics.map(m => m.attentionScore));
      }

      faceDetectionRate = (metrics.filter(m => m.facePresent).length / metrics.length) * 100;
      totalDistractions = metrics.reduce((sum, m) => sum + (m.distractionCount || 0), 0);
    }

    // Update session with final metrics
    await req.db.collection('sessions').updateOne(
      { id: sessionId },
      { 
        $set: { 
          end_time: endTime,
          duration: duration,
          is_active: false,
          updated_at: endTime,
          avg_attention: Math.round(avgAttention),
          avg_fatigue: Math.round(avgFatigue),
          face_detection_rate: Math.round(faceDetectionRate),
          total_distractions: totalDistractions,
          peak_attention: Math.round(peakAttention),
          lowest_attention: Math.round(lowestAttention)
        } 
      }
    );

    // Update goal progress if this was a goal session
    if (session.goal_id) {
      const goal = await req.db.collection('goals').findOne({ id: session.goal_id });
      
      if (goal) {
        const currentTimeSpent = goal.total_time_spent || 0;
        const newTimeSpent = currentTimeSpent + duration;
        const sessionsCompleted = (goal.sessions_completed || 0) + 1;

        await req.db.collection('goals').updateOne(
          { id: session.goal_id },
          {
            $set: {
              total_time_spent: newTimeSpent,
              sessions_completed: sessionsCompleted,
              last_session: endTime,
              updated_at: endTime,
              avg_attention: avgAttention,
              progress: Math.min(100, (newTimeSpent / (goal.target_hours * 3600)) * 100)
            }
          }
        );

        console.log(`✓ Goal updated: ${session.goal_id}, Time: ${newTimeSpent}s`);
      }
    }

    console.log(`✓ Session ended: ${sessionId}, Duration: ${duration}s`);

    res.json({
      message: 'Session ended successfully',
      session_summary: {
        duration: duration,
        duration_formatted: formatDuration(duration),
        avg_attention: Math.round(avgAttention),
        avg_fatigue: Math.round(avgFatigue),
        face_detection_rate: Math.round(faceDetectionRate),
        total_distractions: totalDistractions,
        peak_attention: Math.round(peakAttention),
        lowest_attention: Math.round(lowestAttention)
      }
    });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// ============================================
// GET SESSION REPORT
// ============================================
router.get('/:sessionId/report', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await req.db.collection('sessions').findOne({
      id: sessionId,
      student_id: req.user.id
    });

    if (!session) {
      return res.status(404).json({ detail: 'Session not found' });
    }

    // Get time-series metrics
    const metrics = await req.db.collection('metrics')
      .find({ session_id: sessionId })
      .sort({ timestamp: 1 })
      .toArray();

    // Get room info
    const room = await req.db.collection('rooms').findOne({ id: session.room_id });

    // Build attention timeline (sampled every 30 seconds)
    const attentionTimeline = [];
    const fatigueTimeline = [];
    const timeInterval = 30; // seconds

    if (metrics.length > 0) {
      const startTime = new Date(session.start_time).getTime() / 1000;
      const endTime = session.end_time ? new Date(session.end_time).getTime() / 1000 : Date.now() / 1000;
      
      for (let t = startTime; t <= endTime; t += timeInterval) {
        const relevantMetrics = metrics.filter(m => {
          const metricTime = m.timestamp || (new Date(m.created_at).getTime() / 1000);
          return Math.abs(metricTime - t) < timeInterval;
        });

        if (relevantMetrics.length > 0) {
          const avgAttn = relevantMetrics.reduce((sum, m) => sum + (m.attentionScore || 0), 0) / relevantMetrics.length;
          const avgFat = relevantMetrics.reduce((sum, m) => sum + (m.fatigueLevel || 0), 0) / relevantMetrics.length;
          attentionTimeline.push(Math.round(avgAttn));
          fatigueTimeline.push(Math.round(avgFat));
        }
      }
    }

    res.json({
      session: {
        id: session.id,
        goal_title: session.goal_title,
        subjects: session.subjects,
        start_time: session.start_time,
        end_time: session.end_time,
        duration: session.duration,
        duration_formatted: formatDuration(session.duration)
      },
      room: {
        title: room?.title,
        subject: room?.subject
      },
      summary: {
        avg_attention: session.avg_attention || 0,
        avg_fatigue: session.avg_fatigue || 0,
        face_detection_rate: session.face_detection_rate || 0,
        total_distractions: session.total_distractions || 0,
        peak_attention: session.peak_attention || 0,
        lowest_attention: session.lowest_attention || 100
      },
      timeline: {
        attention: attentionTimeline,
        fatigue: fatigueTimeline
      },
      metrics_count: metrics.length
    });
  } catch (error) {
    console.error('Get session report error:', error);
    res.status(500).json({ detail: 'Failed to fetch report' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h}h ${m}m`;
  } else if (m > 0) {
    return `${m}m ${s}s`;
  } else {
    return `${s}s`;
  }
}

module.exports = router;