const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.get('/progress', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const studentId = req.user.id;

    const now = new Date();
    let startDate;
    
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(0);
    }

    const sessions = await req.db.collection('sessions').find({
      student_id: studentId,
      start_time: { $gte: startDate }
    }).toArray();

    if (sessions.length === 0) {
      return res.json({
        totalStudyTime: 0,
        averageAttention: 0,
        averageFatigue: 0,
        totalSessions: 0,
        recentSessions: [],
        subjectStats: [],
        attentionTrend: [],
        alerts: []
      });
    }

    const sessionIds = sessions.map(s => s.id);
    const metrics = await req.db.collection('metrics').find({ 
      session_id: { $in: sessionIds } 
    }).toArray();

    let totalStudyTime = 0;
    const attentionScores = [];
    const fatigueScores = [];

    sessions.forEach(session => {
      if (session.end_time) {
        const duration = (new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60);
        totalStudyTime += duration;
      }
    });

    metrics.forEach(metric => {
      if (metric.attention_score != null) attentionScores.push(metric.attention_score);
      if (metric.fatigue_level != null) fatigueScores.push(metric.fatigue_level);
    });

    const avgAttention = attentionScores.length > 0 
      ? attentionScores.reduce((a, b) => a + b, 0) / attentionScores.length 
      : 0;
    
    const avgFatigue = fatigueScores.length > 0 
      ? fatigueScores.reduce((a, b) => a + b, 0) / fatigueScores.length 
      : 0;

    const recentSessions = [];
    const sortedSessions = sessions.sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).slice(0, 10);
    
    for (let session of sortedSessions) {
      const room = await req.db.collection('rooms').findOne({ id: session.room_id });
      const duration = session.end_time 
        ? (new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60)
        : 0;
      
      const sessionMetrics = metrics.filter(m => m.session_id === session.id);
      const sessionAttention = sessionMetrics.length > 0
        ? sessionMetrics.reduce((sum, m) => sum + (m.attention_score || 0), 0) / sessionMetrics.length
        : 0;
      const sessionFatigue = sessionMetrics.length > 0
        ? sessionMetrics.reduce((sum, m) => sum + (m.fatigue_level || 0), 0) / sessionMetrics.length
        : 0;

      recentSessions.push({
        date: session.start_time,
        subject: room ? room.subject : 'Unknown',
        duration: Math.round(duration),
        avgAttention: Math.round(sessionAttention),
        avgFatigue: Math.round(sessionFatigue)
      });
    }

    res.json({
      totalStudyTime: Math.round(totalStudyTime),
      averageAttention: Math.round(avgAttention),
      averageFatigue: Math.round(avgFatigue),
      totalSessions: sessions.length,
      recentSessions,
      subjectStats: [],
      attentionTrend: [],
      alerts: [],
      dailyStats: [],
      goals: {
        dailyTarget: 180,
        weeklyTarget: 1260,
        targetAttention: 75
      },
      achievements: [
        { title: 'Study Streak', description: 'Active learner', icon: '🔥', earned: true },
        { title: 'Focus Master', description: 'Good attention levels', icon: '🎯', earned: false }
      ]
    });
  } catch (error) {
    console.error('Get student progress error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

router.get('/goals', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const goals = await req.db.collection('goals').find({ 
      student_id: req.user.id 
    }).toArray();

    const goalsWithProgress = await Promise.all(goals.map(async (goal) => {
      const sessions = await req.db.collection('sessions').find({
        student_id: req.user.id,
        start_time: { 
          $gte: new Date(goal.startDate), 
          $lte: new Date(goal.endDate + 'T23:59:59.999Z') 
        },
        end_time: { $ne: null }
      }).toArray();

      let studiedMinutes = 0;
      sessions.forEach(session => {
        if (session.end_time) {
          const duration = (new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60);
          studiedMinutes += duration;
        }
      });

      const progress = Math.min((studiedMinutes / goal.targetMinutes) * 100, 100);

      return {
        ...goal,
        studiedMinutes: Math.round(studiedMinutes),
        progress: Math.round(progress)
      };
    }));

    goalsWithProgress.forEach(goal => delete goal._id);

    res.json(goalsWithProgress);
  } catch (error) {
    console.error('Get student goals error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

router.post('/goals', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { subject, targetMinutes, period, startDate, endDate, description } = req.body;

    const goal = {
      id: uuidv4(),
      student_id: req.user.id,
      subject,
      targetMinutes,
      period,
      startDate,
      endDate,
      description: description || '',
      created_at: new Date(),
      status: 'active'
    };

    await req.db.collection('goals').insertOne(goal);
    delete goal._id;

    res.json({
      ...goal,
      studiedMinutes: 0,
      progress: 0
    });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

router.delete('/goals/:goalId', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { goalId } = req.params;

    const goal = await req.db.collection('goals').findOne({ 
      id: goalId, 
      student_id: req.user.id 
    });
    
    if (!goal) {
      return res.status(404).json({ detail: 'Goal not found' });
    }

    await req.db.collection('goals').deleteOne({ id: goalId });

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

router.get('/students', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const teacherRooms = await req.db.collection('rooms').find({ teacher_id: req.user.id }).toArray();
    const roomIds = teacherRooms.map(room => room.id);

    const sessions = await req.db.collection('sessions').find({ 
      room_id: { $in: roomIds } 
    }).toArray();

    const studentStats = {};
    
    for (let session of sessions) {
      const studentId = session.student_id;
      
      if (!studentStats[studentId]) {
        const student = await req.db.collection('users').findOne({ id: studentId });
        if (student) {
          studentStats[studentId] = {
            id: studentId,
            name: student.name,
            email: student.email,
            class: '10th Grade',
            total_sessions: 0,
            avg_attention: 0,
            last_session: null,
            status: 'active'
          };
        }
      }

      if (studentStats[studentId]) {
        studentStats[studentId].total_sessions += 1;
        if (session.end_time) {
          studentStats[studentId].last_session = session.end_time;
        } else if (!studentStats[studentId].last_session) {
          studentStats[studentId].last_session = session.start_time;
        }
      }
    }

    for (let studentId in studentStats) {
      const studentSessions = sessions.filter(s => s.student_id === studentId);
      const sessionIds = studentSessions.map(s => s.id);
      
      if (sessionIds.length > 0) {
        const metrics = await req.db.collection('metrics').find({ 
          session_id: { $in: sessionIds } 
        }).toArray();
        
        const attentionScores = metrics
          .map(m => m.attention_score)
          .filter(score => score != null);
        
        if (attentionScores.length > 0) {
          studentStats[studentId].avg_attention = Math.round(
            attentionScores.reduce((a, b) => a + b, 0) / attentionScores.length
          );
        }
      }
    }

    res.json(Object.values(studentStats));
  } catch (error) {
    console.error('Get teacher students error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

router.get('/students/:studentId', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await req.db.collection('users').findOne({ 
      id: studentId, 
      role: 'student' 
    });
    
    if (!student) {
      return res.status(404).json({ detail: 'Student not found' });
    }

    res.json({
      id: student.id,
      name: student.name,
      email: student.email,
      class: '10th Grade',
      enrollment_date: student.created_at
    });
  } catch (error) {
    console.error('Get student info error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

router.get('/students/:studentId/progress', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { period = 'week' } = req.query;

    const student = await req.db.collection('users').findOne({ 
      id: studentId, 
      role: 'student' 
    });
    
    if (!student) {
      return res.status(404).json({ detail: 'Student not found' });
    }

    const now = new Date();
    let startDate;
    
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(0);
    }

    const teacherRooms = await req.db.collection('rooms').find({ teacher_id: req.user.id }).toArray();
    const roomIds = teacherRooms.map(room => room.id);

    const sessions = await req.db.collection('sessions').find({
      student_id: studentId,
      room_id: { $in: roomIds },
      start_time: { $gte: startDate }
    }).toArray();

    if (sessions.length === 0) {
      return res.json({
        totalStudyTime: 0,
        averageAttention: 0,
        averageFatigue: 0,
        totalSessions: 0,
        recentSessions: [],
        subjectStats: [],
        attentionTrend: [],
        alerts: []
      });
    }

    const sessionIds = sessions.map(s => s.id);
    const metrics = await req.db.collection('metrics').find({ 
      session_id: { $in: sessionIds } 
    }).toArray();

    let totalStudyTime = 0;
    const attentionScores = [];
    const fatigueScores = [];

    sessions.forEach(session => {
      if (session.end_time) {
        const duration = (new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60);
        totalStudyTime += duration;
      }
    });

    metrics.forEach(metric => {
      if (metric.attention_score != null) attentionScores.push(metric.attention_score);
      if (metric.fatigue_level != null) fatigueScores.push(metric.fatigue_level);
    });

    const avgAttention = attentionScores.length > 0 
      ? attentionScores.reduce((a, b) => a + b, 0) / attentionScores.length 
      : 0;
    
    const avgFatigue = fatigueScores.length > 0 
      ? fatigueScores.reduce((a, b) => a + b, 0) / fatigueScores.length 
      : 0;

    const recentSessions = [];
    const sortedSessions = sessions.sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).slice(0, 10);
    
    for (let session of sortedSessions) {
      const room = await req.db.collection('rooms').findOne({ id: session.room_id });
      const duration = session.end_time 
        ? (new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60)
        : 0;
      
      const sessionMetrics = metrics.filter(m => m.session_id === session.id);
      const sessionAttention = sessionMetrics.length > 0
        ? sessionMetrics.reduce((sum, m) => sum + (m.attention_score || 0), 0) / sessionMetrics.length
        : 0;
      const sessionFatigue = sessionMetrics.length > 0
        ? sessionMetrics.reduce((sum, m) => sum + (m.fatigue_level || 0), 0) / sessionMetrics.length
        : 0;

      recentSessions.push({
        date: session.start_time,
        subject: room ? room.subject : 'Unknown',
        duration: Math.round(duration),
        avgAttention: Math.round(sessionAttention),
        avgFatigue: Math.round(sessionFatigue)
      });
    }

    res.json({
      totalStudyTime: Math.round(totalStudyTime),
      averageAttention: Math.round(avgAttention),
      averageFatigue: Math.round(avgFatigue),
      totalSessions: sessions.length,
      recentSessions,
      subjectStats: [],
      attentionTrend: [],
      alerts: [],
      dailyStats: [],
      goals: {
        dailyTarget: 180,
        weeklyTarget: 1260,
        targetAttention: 75
      },
      achievements: [
        { title: 'Study Streak', description: '7 days in a row!', icon: '🔥', earned: true },
        { title: 'Focus Master', description: 'Maintained 80%+ attention for 1 hour', icon: '🎯', earned: false },
        { title: 'Early Bird', description: 'Studied before 8 AM', icon: '🌅', earned: false },
        { title: 'Night Owl', description: 'Studied after 10 PM', icon: '🦉', earned: false }
      ]
    });
  } catch (error) {
    console.error('Get student progress error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;