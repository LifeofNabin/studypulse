const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const multer = require('multer');
const path = require('path');

const upload = multer({ dest: 'uploads/temp/' });

// Middleware to check if user is authenticated
const authenticateToken = async (req, res, next) => {
  // Your existing auth middleware will be applied
  next();
};

// 1. Analyze PDF
router.post('/analyze-pdf/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { analysisType = 'summary' } = req.body;

    // Get room and PDF path
    const room = await req.app.locals.db.collection('rooms').findOne({ id: roomId });
    
    if (!room || !room.pdf_file) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const analysis = await aiService.analyzePDF(room.pdf_file.path, analysisType);

    // Save analysis to database
    if (analysis.success) {
      await req.app.locals.db.collection('ai_analyses').insertOne({
        userId: req.user.id,
        roomId,
        type: analysisType,
        result: analysis,
        createdAt: new Date()
      });
    }

    res.json(analysis);
  } catch (error) {
    console.error('PDF Analysis Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Analyze Study Session
router.post('/analyze-session', authenticateToken, async (req, res) => {
  try {
    const sessionData = req.body;
    const analysis = await aiService.analyzeStudySession(sessionData);

    if (analysis.success) {
      await req.app.locals.db.collection('ai_session_analyses').insertOne({
        userId: req.user.id,
        sessionData,
        analysis: analysis.analysis,
        createdAt: new Date()
      });
    }

    res.json(analysis);
  } catch (error) {
    console.error('Session Analysis Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Generate Study Plan
router.post('/study-plan', authenticateToken, async (req, res) => {
  try {
    const studentData = req.body;
    const plan = await aiService.generateStudyPlan(studentData);

    if (plan.success) {
      await req.app.locals.db.collection('ai_study_plans').insertOne({
        userId: req.user.id,
        plan: plan.plan,
        createdAt: new Date()
      });
    }

    res.json(plan);
  } catch (error) {
    console.error('Study Plan Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Ask Question (AI Tutor)
router.post('/ask', authenticateToken, async (req, res) => {
  try {
    const { question, context = '' } = req.body;
    const answer = await aiService.answerQuestion(question, context);

    if (answer.success) {
      await req.app.locals.db.collection('ai_interactions').insertOne({
        userId: req.user.id,
        question,
        answer: answer.answer,
        createdAt: new Date()
      });
    }

    res.json(answer);
  } catch (error) {
    console.error('Question Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Get Study Tips
router.post('/study-tips', authenticateToken, async (req, res) => {
  try {
    const { subject, level = 'intermediate' } = req.body;
    const tips = await aiService.getStudyTips(subject, level);
    res.json(tips);
  } catch (error) {
    console.error('Study Tips Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Predict Exam Readiness
router.post('/predict-readiness', authenticateToken, async (req, res) => {
  try {
    const progressData = req.body;
    const prediction = await aiService.predictReadiness(progressData);
    res.json(prediction);
  } catch (error) {
    console.error('Readiness Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;