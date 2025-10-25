// backend/routes/goals.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// GET ALL GOALS
// ============================================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const goals = await req.db.collection('goals')
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .toArray();

    console.log(`✓ Fetched ${goals.length} goals for user: ${req.user.email}`);
    res.json(goals);
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ detail: 'Failed to fetch goals' });
  }
});

// ============================================
// CREATE NEW GOAL
// ============================================
router.post('/', async (req, res) => {
  try {
    const {
      title,
      subjects,
      target_hours,
      hours_per_day,
      days_left,
      priority,
      target_date
    } = req.body;

    if (!title || !subjects || subjects.length === 0 || !target_date) {
      return res.status(400).json({ detail: 'Title, subjects, and target date are required' });
    }

    const goalId = uuidv4();
    const userId = req.user.id;

    const newGoal = {
      id: goalId,
      user_id: userId,
      title,
      subjects,
      target_hours: target_hours || 0,
      hours_per_day: hours_per_day || 0,
      days_left: days_left || 0,
      priority: priority || 'medium',
      target_date: new Date(target_date),
      status: 'active',
      progress: 0,
      total_time_spent: 0,
      sessions_completed: 0,
      avg_attention: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    await req.db.collection('goals').insertOne(newGoal);

    console.log(`✓ Goal created: ${title} for user: ${req.user.email}`);
    res.status(201).json(newGoal);
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ detail: 'Failed to create goal' });
  }
});

// ============================================
// GET SINGLE GOAL
// ============================================
router.get('/:goalId', async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.id;

    const goal = await req.db.collection('goals').findOne({
      id: goalId,
      user_id: userId
    });

    if (!goal) {
      return res.status(404).json({ detail: 'Goal not found' });
    }

    res.json(goal);
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({ detail: 'Failed to fetch goal' });
  }
});

// ============================================
// UPDATE GOAL
// ============================================
router.put('/:goalId', async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // Check if goal exists and belongs to user
    const goal = await req.db.collection('goals').findOne({
      id: goalId,
      user_id: userId
    });

    if (!goal) {
      return res.status(404).json({ detail: 'Goal not found' });
    }

    // Update goal
    const updateData = {
      ...updates,
      updated_at: new Date()
    };

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.user_id;
    delete updateData._id;

    await req.db.collection('goals').updateOne(
      { id: goalId, user_id: userId },
      { $set: updateData }
    );

    const updatedGoal = await req.db.collection('goals').findOne({
      id: goalId,
      user_id: userId
    });

    console.log(`✓ Goal updated: ${goalId}`);
    res.json(updatedGoal);
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ detail: 'Failed to update goal' });
  }
});

// ============================================
// DELETE GOAL
// ============================================
router.delete('/:goalId', async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.id;

    const result = await req.db.collection('goals').deleteOne({
      id: goalId,
      user_id: userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ detail: 'Goal not found' });
    }

    console.log(`✓ Goal deleted: ${goalId}`);
    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ detail: 'Failed to delete goal' });
  }
});

// ============================================
// GET GOAL STATISTICS
// ============================================
router.get('/:goalId/stats', async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.id;

    const goal = await req.db.collection('goals').findOne({
      id: goalId,
      user_id: userId
    });

    if (!goal) {
      return res.status(404).json({ detail: 'Goal not found' });
    }

    // Get all sessions for this goal
    const sessions = await req.db.collection('sessions')
      .find({ goal_id: goalId, student_id: userId })
      .sort({ start_time: -1 })
      .toArray();

    // Calculate stats
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => !s.is_active).length;
    const totalTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgAttention = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.avg_attention || 0), 0) / sessions.length
      : 0;

    res.json({
      goal,
      stats: {
        total_sessions: totalSessions,
        completed_sessions: completedSessions,
        total_time_seconds: totalTime,
        total_time_formatted: formatDuration(totalTime),
        avg_attention: Math.round(avgAttention),
        progress: goal.progress || 0,
        days_remaining: Math.ceil((new Date(goal.target_date) - new Date()) / (1000 * 60 * 60 * 24))
      },
      recent_sessions: sessions.slice(0, 5)
    });
  } catch (error) {
    console.error('Get goal stats error:', error);
    res.status(500).json({ detail: 'Failed to fetch goal statistics' });
  }
});

// Helper function
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

module.exports = router;