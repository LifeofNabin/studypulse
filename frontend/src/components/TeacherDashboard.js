import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const TeacherDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newRoom, setNewRoom] = useState({
    title: '',
    subject: '',
    description: ''
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/rooms`);
      setRooms(response.data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/api/rooms`, newRoom);
      setRooms([...rooms, response.data]);
      setNewRoom({ title: '', subject: '', description: '' });
      setShowCreateRoom(false);
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const handleStartMonitoring = (roomId) => {
    navigate(`/teacher/room/${roomId}/monitor`);
  };

  if (loading) {
    return <div className="loading-spinner">Loading rooms...</div>;
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
        <div className="dashboard-title">Teacher Dashboard</div>
        <div className="dashboard-subtitle">
          Manage your study rooms and monitor student progress
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Study Rooms</h3>
            <button
              onClick={() => setShowCreateRoom(true)}
              className="btn-primary"
              style={{ width: 'auto' }}
            >
              Create New Room
            </button>
          </div>

          {showCreateRoom && (
            <div style={{ 
              background: '#f8fafc', 
              padding: '24px', 
              borderRadius: '12px', 
              marginBottom: '24px' 
            }}>
              <h4 style={{ marginBottom: '16px', color: '#1a1a2e' }}>Create New Study Room</h4>
              <form onSubmit={handleCreateRoom}>
                <div className="form-group">
                  <label className="form-label">Room Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Mathematics Study Session"
                    value={newRoom.title}
                    onChange={(e) => setNewRoom({...newRoom, title: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Mathematics, Science, English"
                    value={newRoom.subject}
                    onChange={(e) => setNewRoom({...newRoom, subject: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-input"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="Brief description of the study session"
                    value={newRoom.description}
                    onChange={(e) => setNewRoom({...newRoom, description: e.target.value})}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
                    Create Room
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateRoom(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {rooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <p>No study rooms created yet.</p>
              <p>Create your first room to start monitoring students.</p>
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
                      onClick={() => handleStartMonitoring(room.id)}
                      className="btn-room"
                    >
                      Start Monitoring
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;