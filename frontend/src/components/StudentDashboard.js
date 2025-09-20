import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

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
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;