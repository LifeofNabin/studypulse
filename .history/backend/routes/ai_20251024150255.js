const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { OpenAI } = require('openai');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const { roomId, sessionId, type } = req.body;

    if (!roomId || !sessionId || !type) {
      return res.status(400).json({ detail: 'Missing roomId, sessionId, or type' });
    }

    // Validate session
    const session = await req.db.collection('sessions').findOne({
      id: sessionId,
      room_id: roomId,
      student_id: req.user.id,
      is_active: true
    });

    if (!session) {
      return res.status(403).json({ detail: 'Invalid session or access denied' });
    }

    // Get room and PDF
    const room = await req.db.collection('rooms').findOne({ id: roomId });
    if (!room || !room.pdf_file) {
      return res.status(404).json({ detail: 'Room or PDF not found' });
  }

    // Read PDF file
    const pdfPath = path.join(__dirname, '..', 'Uploads', 'pdfs', room.pdf_file.filename);
    try {
      await fs.access(pdfPath);
    } catch (err) {
      return res.status(404).json({ detail: 'PDF file not found on server' });
  }

    const pdfBuffer = await fs.readFile(pdfPath);

    // Dynamically import pdf-parse
    const { default: pdfParse } = await import('pdf-parse');
    const pdfData = await pdfParse(pdfBuffer);

    // Analyze based on type
    let result;
    if (type === 'summarize') {
      const prompt = `Summarize the following PDF content in 100 words or less:\n\n${pdfData.text}`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150
      });
      result = completion.choices[0].message.content;
    } else if (type === 'question') {
      const prompt = `Generate 5 quiz questions based on the following PDF content:\n\n${pdfData.text}`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300
      });
      result = completion.choices[0].message.content;
    } else if (type === 'metrics') {
      // Mock study session metrics (replace with actual webcam analysis)
      result = {
        attention_score: 83.9,
        fatigue_level: 30,
        looking_at_screen: true,
        blink_rate: 1,
        distractions: 0,
        posture_lean: 4.3,
        head_position: { yaw: 5, pitch: 11, roll: 5 },
        avg_attention: 84,
        peak_attention: 88.4,
        total_distractions: 0
      };
    } else {
      return res.status(400).json({ detail: 'Invalid analysis type' });
    }

    res.json({
      type,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ detail: 'Failed to analyze' });
  }
});

module.exports = router;