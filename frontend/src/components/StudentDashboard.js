import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import StudyRoutine from "./StudyRoutine";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAvailableRooms();
  }, []);

  const fetchAvailableRooms = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/rooms`);
      setRooms(response.data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (roomCode) => {
    try {
      setError('');
      const response = await axios.post(`${API_BASE_URL}/api/rooms/${roomCode}/join`);
      const sessionId = response.data.session_id;
      navigate(`/session/${sessionId}`);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to join room');
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (joinCode.trim()) {
      await handleJoinRoom(joinCode.trim().toUpperCase());
    }
  };

  if (loading) {
    return <div className="loading-spinner">Loading available rooms...</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-nav">
          <div className="dashboard-logo">StudyGuardian</div>
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
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
          Join a study room to begin your monitored study session
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Quick Actions Section */}
        <div className="quick-actions-section" style={{ marginBottom: '24px' }}>
          <div className="quick-actions-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '32px'
          }}>
            {/* Progress Button */}
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
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0px)'}
            >
              <span style={{ fontSize: '2rem' }}>📊</span>
              <span>View Progress</span>
              <span style={{ fontSize: '0.8rem', opacity: '0.9' }}>Track your analytics</span>
            </button>

            {/* Study Goals Button - UPDATED */}
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
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0px)'}
            >
              <span style={{ fontSize: '2rem' }}>🎯</span>
              <span>Study Goals</span>
              <span style={{ fontSize: '0.8rem', opacity: '0.9' }}>Set your targets</span>
            </button>

            {/* Study Routine Button - NEW */}
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
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0px)'}
            >
              <span style={{ fontSize: '2rem' }}>📚</span>
              <span>Study Routine</span>
              <span style={{ fontSize: '0.8rem', opacity: '0.9' }}>Plan your schedule</span>
            </button>
          </div>
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

          <div style={{ 
            borderTop: '1px solid #e5e7eb', 
            paddingTop: '24px',
            marginTop: '24px' 
          }}>
            <h4 style={{ marginBottom: '16px', color: '#1a1a2e' }}>Available Study Rooms</h4>
            
            {rooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                <p>No study rooms available at the moment.</p>
                <p>Ask your teacher for a room code to join a session.</p>
              </div>
            ) : (
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
                      >
                        Join Session
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Self Study Section with distinct UI */}
          <div className="self-study-card mt-12 p-8 rounded-3xl text-white shadow-xl" 
               style={{
                 background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
                 textAlign: 'center'
               }}>
            <h3 className="text-2xl font-bold mb-2">🚀 Self Study</h3>
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