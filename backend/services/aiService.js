const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.enabled = process.env.ENABLE_AI_FEATURES === 'true';
  }

  isEnabled() {
    return this.enabled && this.openai.apiKey;
  }

  // 1. Analyze PDF Content
  async analyzePDF(pdfPath, analysisType = 'summary') {
    if (!this.isEnabled()) {
      return { success: false, error: 'AI features not enabled' };
    }

    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text.substring(0, 8000);

      const prompts = {
        summary: `Analyze this study material and provide:
1. Brief summary (100-150 words)
2. 5-7 key concepts
3. Main topics covered
4. Important points to remember

Material: ${text}`,

        questions: `Generate 10 practice questions from this material:
- 5 multiple choice (with correct answers)
- 3 short answer questions
- 2 essay questions

Material: ${text}`,

        flashcards: `Create 10 study flashcards in JSON format:
{"flashcards": [{"front": "Question/Term", "back": "Answer/Definition"}]}

Material: ${text}`
      };

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert educational content analyzer." },
          { role: "user", content: prompts[analysisType] || prompts.summary }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      return {
        success: true,
        analysis: response.choices[0].message.content,
        type: analysisType,
        metadata: {
          pageCount: pdfData.numpages,
          wordCount: pdfData.text.split(/\s+/).length
        }
      };
    } catch (error) {
      console.error('PDF Analysis Error:', error);
      return { success: false, error: error.message };
    }
  }

  // 2. Analyze Study Session
  async analyzeStudySession(sessionData) {
    if (!this.isEnabled()) {
      return { success: false, error: 'AI features not enabled' };
    }

    try {
      const { duration, avgAttention, avgFatigue, subject } = sessionData;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a learning analytics expert." },
          { 
            role: "user", 
            content: `Analyze this study session:
Duration: ${duration} minutes
Attention: ${avgAttention}%
Fatigue: ${avgFatigue}%
Subject: ${subject}

Provide JSON: {"effectiveness": "Good/Fair/Excellent", "strengths": [], "improvements": [], "recommendations": []}`
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" }
      });

      return {
        success: true,
        analysis: JSON.parse(response.choices[0].message.content)
      };
    } catch (error) {
      console.error('Session Analysis Error:', error);
      return { success: false, error: error.message };
    }
  }

  // 3. Generate Study Plan
  async generateStudyPlan(studentData) {
    if (!this.isEnabled()) {
      return { success: false, error: 'AI features not enabled' };
    }

    try {
      const { subjects, availableHours, goals, weakAreas } = studentData;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert study planner." },
          { 
            role: "user", 
            content: `Create a weekly study plan:
Subjects: ${subjects.join(', ')}
Hours available: ${availableHours}/week
Weak areas: ${weakAreas.join(', ')}
Goals: ${goals}

Return JSON with: {"overview": "", "weeklySchedule": [], "priorities": [], "studyTechniques": []}`
          }
        ],
        temperature: 0.8,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      return {
        success: true,
        plan: JSON.parse(response.choices[0].message.content)
      };
    } catch (error) {
      console.error('Study Plan Error:', error);
      return { success: false, error: error.message };
    }
  }

  // 4. Answer Questions (AI Tutor)
  async answerQuestion(question, context = '') {
    if (!this.isEnabled()) {
      return { success: false, error: 'AI features not enabled' };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: context 
              ? `You are a helpful tutor. Use this context: ${context.substring(0, 2000)}`
              : "You are a helpful tutor. Explain clearly with examples."
          },
          { role: "user", content: question }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return {
        success: true,
        answer: response.choices[0].message.content
      };
    } catch (error) {
      console.error('Question Error:', error);
      return { success: false, error: error.message };
    }
  }

  // 5. Get Study Tips
  async getStudyTips(subject, level = 'intermediate') {
    if (!this.isEnabled()) {
      return { success: false, error: 'AI features not enabled' };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a study strategies expert." },
          { 
            role: "user", 
            content: `Give 5 specific study tips for ${subject} (${level} level). Return as JSON: {"tips": [{"title": "", "description": ""}]}`
          }
        ],
        temperature: 0.8,
        max_tokens: 600,
        response_format: { type: "json_object" }
      });

      return {
        success: true,
        tips: JSON.parse(response.choices[0].message.content)
      };
    } catch (error) {
      console.error('Study Tips Error:', error);
      return { success: false, error: error.message };
    }
  }

  // 6. Predict Exam Readiness
  async predictReadiness(progressData) {
    if (!this.isEnabled()) {
      return { success: false, error: 'AI features not enabled' };
    }

    try {
      const { totalHours, avgAttention, completedTopics, totalTopics, daysLeft } = progressData;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an educational assessment expert." },
          { 
            role: "user", 
            content: `Predict exam readiness:
Study hours: ${totalHours}
Avg attention: ${avgAttention}%
Progress: ${completedTopics}/${totalTopics} topics
Days left: ${daysLeft}

Return JSON: {"readinessScore": 0-100, "confidence": "High/Medium/Low", "recommendations": [], "focusAreas": []}`
          }
        ],
        temperature: 0.6,
        max_tokens: 800,
        response_format: { type: "json_object" }
      });

      return {
        success: true,
        prediction: JSON.parse(response.choices[0].message.content)
      };
    } catch (error) {
      console.error('Readiness Prediction Error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AIService();