import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// Get auth token
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

class AIServiceClient {
  // 1. Analyze PDF
  async analyzePDF(roomId, analysisType = 'summary') {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/ai/analyze-pdf/${roomId}`,
        { analysisType },
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('AI PDF Analysis Error:', error);
      return { success: false, error: 'AI service unavailable' };
    }
  }

  // 2. Analyze Session
  async analyzeSession(sessionData) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/ai/analyze-session`,
        sessionData,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('AI Session Analysis Error:', error);
      return { success: false, error: 'AI service unavailable' };
    }
  }

  // 3. Generate Study Plan
  async generateStudyPlan(studentData) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/ai/study-plan`,
        studentData,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('AI Study Plan Error:', error);
      return { success: false, error: 'AI service unavailable' };
    }
  }

  // 4. Ask Question
  async askQuestion(question, context = '') {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/ai/ask`,
        { question, context },
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('AI Question Error:', error);
      return { success: false, error: 'AI service unavailable' };
    }
  }

  // 5. Get Study Tips
  async getStudyTips(subject, level = 'intermediate') {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/ai/study-tips`,
        { subject, level },
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('AI Study Tips Error:', error);
      return { success: false, error: 'AI service unavailable' };
    }
  }

  // 6. Predict Readiness
  async predictReadiness(progressData) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/ai/predict-readiness`,
        progressData,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('AI Readiness Prediction Error:', error);
      return { success: false, error: 'AI service unavailable' };
    }
  }
}

export default new AIServiceClient();