import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import aiService from '../services/aiService';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchAvailableRooms();
  }, []);

  const fetchAvailableRooms = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching rooms with token:', token ? 'Present' : 'Missing');
      const response = await axios.get(`${API_BASE_URL}/api/rooms`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setRooms(response.data);
    } catch (error) {
      console.error('Error fetching rooms:', error.response?.data);
      setError(error.response?.data?.detail || 'Failed to fetch rooms');
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (roomCode) => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      console.log('Joining room with room_code:', roomCode); // Debug log
      const response = await axios.post(
        `${API_BASE_URL}/api/rooms/join`,
        { room_code: roomCode.trim().toUpperCase() },
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const { session_id } = response.data; // Use session_id
      navigate(`/session/${session_id}`); // Navigate to session_id
    } catch (error) {
      console.error('Join room error:', error.response?.data);
      setError(error.response?.data?.detail || 'Failed to join room. Please check the room code or log in again.');
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (joinCode.trim()) {
      await handleJoinRoom(joinCode.trim().toUpperCase());
    }
  };

  const handleAskAI = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    try {
      const result = await aiService.askQuestion(aiQuestion);
      if (result.success) {
        setAiAnswer(result.answer);
      } else {
        setAiAnswer('Sorry, I could not process your question. Please try again.');
      }
    } catch (error) {
      setAiAnswer('Error connecting to AI assistant.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-nav">
          <div className="dashboard-logo">StudyGuardian</div>
          <div className="user-info">
            <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
            <span>Welcome, {user?.name}</span>
            <button onClick={logout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-title">Student Dashboard</div>
        <div className="dashboard-subtitle">
          Join a study room using a room code to begin your monitored study session
        </div>

        {error && (
          <div className="error-message" style={{ color: 'red', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div className="quick-actions-section" style={{ marginBottom: '24px' }}>
          <div className="quick-actions-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '32px'
          }}>
            <button
              className="quick-action-btn progress-btn"
              onClick={() => navigate('/student/progress')}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              <span style={{ fontSize: '2rem' }}>📊</span>
              <span>View Progress</span>
              <span style={{ fontSize: '0.8rem', opacity: '0.9' }}>Track your analytics</span>
            </button>

            <button
              className="quick-action-btn goals-btn"
              onClick={() => navigate('/student/goals')}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <span style={{ fontSize: '2rem' }}>🎯</span>
              <span>Study Goals</span>
              <span style={{ fontSize: '0.8rem', opacity: '0.9' }}>Set your targets</span>
            </button>

            <button
              className="quick-action-btn routine-btn"
              onClick={() => navigate('/study-routine')}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}
            >
              <span style={{ fontSize: '2rem' }}>📚</span>
              <span>Study Routine</span>
              <span style={{ fontSize: '0.8rem', opacity: '0.9' }}>Plan your schedule</span>
            </button>

            <button
              className="quick-action-btn ai-btn"
              onClick={() => setShowAIAssistant(!showAIAssistant)}
              style={{
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)'
              }}
            >
              <span style={{ fontSize: '2rem' }}>🤖</span>
              <span>AI Assistant</span>
              <span style={{ fontSize: '0.8rem', opacity: '0.9' }}>Ask me anything</span>
            </button>
          </div>

          {showAIAssistant && (
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: '600' }}>
                AI Study Assistant
              </h3>
              <div style={{ marginBottom: '16px' }}>
                <textarea
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="Ask me anything about your studies... (e.g., 'Explain photosynthesis', 'Study tips for math')"
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <button
                onClick={handleAskAI}
                disabled={aiLoading || !aiQuestion.trim()}
                style={{
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  cursor: aiLoading ? 'wait' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: (aiLoading || !aiQuestion.trim()) ? 0.6 : 1
                }}
              >
                {aiLoading ? 'Thinking...' : 'Ask AI'}
              </button>

              {aiAnswer && (
                <div style={{
                  marginTop: '20px',
                  padding: '16px',
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  borderLeft: '4px solid #8b5cf6'
                }}>
                  <h4 style={{ marginBottom: '8px', fontWeight: '600' }}>Answer:</h4>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{aiAnswer}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Join Study Room</h3>
          </div>

          <form onSubmit={handleJoinByCode} style={{ marginBottom: '32px' }}>
            <div className="form-group">
              <label className="form-label">Room Code</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter room code (e.g., ABC123)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  style={{ textTransform: 'uppercase' }}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: 'auto', minWidth: '120px' }}
                >
                  Join Room
                </button>
              </div>
            </div>
          </form>

          {rooms.length > 0 && (
            <div style={{
              borderTop: '1px solid #e5e7eb',
              paddingTop: '24px',
              marginTop: '24px'
            }}>
              <h4 style={{ marginBottom: '16px', color: '#1a1a2e' }}>Your Study Rooms</h4>
              <div className="rooms-grid">
                {rooms.map((room) => (
                  <div key={room.id} className="room-card">
                    <div className="room-subject">{room.subject}</div>
                    <h4 className="room-title">{room.title}</h4>
                    {room.description && (
                      <p className="room-description">{room.description}</p>
                    )}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '16px'
                    }}>
                      <div>
                        <strong>Room Code: </strong>
                        <span className="room-code">{room.room_code}</span>
                      </div>
                      <button
                        onClick={() => handleJoinRoom(room.room_code)}
                        className="btn-room"
                      >Join Session
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="self-study-card mt-12 p-8 rounded-3xl text-white shadow-xl"
               style={{
                 background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
                 textAlign: 'center'
               }}>
            <h3 className="text-2xl font-bold mb-2">Self Study</h3>
            <p className="mb-6 text-gray-200">
              Start your own monitored self-study session
            </p>
            <button
              className="py-3 px-6 rounded-xl font-bold bg-white text-pink-600 hover:bg-gray-100 transition-all"
              onClick={() => navigate("/study-routine")}
              style={{ minWidth: "200px" }}
            >
              Start Your Own Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;