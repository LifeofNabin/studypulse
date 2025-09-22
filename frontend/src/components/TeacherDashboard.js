import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const TeacherDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [newRoom, setNewRoom] = useState({
    title: '',
    subject: '',
    description: '',
    duration: 60
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' or 'students'

  useEffect(() => {
    fetchRooms();
    fetchStudents();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/teacher/rooms`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      setRooms(response.data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      // Mock data for development
      setRooms([
        {
          id: 1,
          title: 'Mathematics Study Session',
          subject: 'Mathematics',
          room_code: 'MATH123',
          status: 'active',
          students_count: 5,
          created_at: '2024-01-21T10:00:00Z'
        },
        {
          id: 2,
          title: 'Physics Lab Session',
          subject: 'Physics',
          room_code: 'PHYS456',
          status: 'active',
          students_count: 3,
          created_at: '2024-01-21T14:00:00Z'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/teacher/students`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
      // Mock data for development
      setStudents([
        {
          id: 1,
          name: 'John Doe',
          email: 'john.doe@student.edu',
          class: '10th Grade',
          total_sessions: 24,
          avg_attention: 75,
          last_session: '2024-01-21T10:30:00Z',
          status: 'active'
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane.smith@student.edu',
          class: '10th Grade',
          total_sessions: 18,
          avg_attention: 68,
          last_session: '2024-01-20T15:45:00Z',
          status: 'active'
        },
        {
          id: 3,
          name: 'Mike Johnson',
          email: 'mike.johnson@student.edu',
          class: '10th Grade',
          total_sessions: 31,
          avg_attention: 82,
          last_session: '2024-01-21T09:15:00Z',
          status: 'active'
        }
      ]);
    }
  };

  const createRoom = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const response = await axios.post(`${API_BASE_URL}/api/teacher/rooms`, newRoom, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      setRooms([...rooms, response.data]);
      setNewRoom({ title: '', subject: '', description: '', duration: 60 });
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to create room');
    }
  };

  const deleteRoom = async (roomId) => {
    if (window.confirm('Are you sure you want to delete this room?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/teacher/rooms/${roomId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        setRooms(rooms.filter(room => room.id !== roomId));
      } catch (error) {
        setError('Failed to delete room');
      }
    }
  };

  const getAttentionColor = (score) => {
    if (score >= 75) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleDateString() + ' ' + 
           new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="loading-spinner">Loading dashboard...</div>;
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
          Manage study rooms and monitor student progress
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #e5e7eb',
          marginBottom: '24px'
        }}>
          <button
            onClick={() => setActiveTab('rooms')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'rooms' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'rooms' ? '#3b82f6' : '#6b7280',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Study Rooms ({rooms.length})
          </button>
          <button
            onClick={() => setActiveTab('students')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'students' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'students' ? '#3b82f6' : '#6b7280',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            My Students ({students.length})
          </button>
        </div>

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Create New Study Room</h3>
              </div>

              <form onSubmit={createRoom}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
                    <select
                      className="form-input"
                      value={newRoom.subject}
                      onChange={(e) => setNewRoom({...newRoom, subject: e.target.value})}
                      required
                    >
                      <option value="">Select Subject</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Biology">Biology</option>
                      <option value="English">English</option>
                      <option value="History">History</option>
                      <option value="Computer Science">Computer Science</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-input"
                    placeholder="Brief description of the study session..."
                    value={newRoom.description}
                    onChange={(e) => setNewRoom({...newRoom, description: e.target.value})}
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expected Duration (minutes)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="60"
                    value={newRoom.duration}
                    onChange={(e) => setNewRoom({...newRoom, duration: parseInt(e.target.value)})}
                    min="15"
                    max="300"
                    required
                  />
                </div>

                <button type="submit" className="btn-primary">
                  Create Study Room
                </button>
              </form>
            </div>

            <div style={{ 
              borderTop: '1px solid #e5e7eb', 
              paddingTop: '24px',
              marginTop: '24px' 
            }}>
              <h4 style={{ marginBottom: '16px', color: '#1a1a2e' }}>Active Study Rooms</h4>
              
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
                      
                      <div style={{ margin: '16px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span>Room Code:</span>
                          <span className="room-code" style={{ fontWeight: 'bold', color: '#3b82f6' }}>
                            {room.room_code}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span>Students:</span>
                          <span style={{ fontWeight: '600' }}>{room.students_count}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span>Status:</span>
                          <span style={{ 
                            color: room.status === 'active' ? '#22c55e' : '#f59e0b',
                            fontWeight: '600',
                            textTransform: 'capitalize'
                          }}>
                            {room.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Created:</span>
                          <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                            {new Date(room.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div style={{ 
                        display: 'flex', 
                        gap: '8px',
                        marginTop: '16px'
                      }}>
                        <button
                          onClick={() => navigate(`/teacher/room/${room.id}/monitor`)}
                          className="btn-room"
                          style={{ flex: 1 }}
                        >
                          Monitor
                        </button>
                        <button
                          onClick={() => deleteRoom(room.id)}
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Student Management</h3>
                <p style={{ color: '#6b7280', margin: '8px 0 0 0' }}>
                  Monitor individual student progress and performance
                </p>
              </div>

              {students.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <p>No students enrolled yet.</p>
                  <p>Students will appear here after joining your study rooms.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    background: 'white',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                          Student
                        </th>
                        <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                          Class
                        </th>
                        <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>
                          Sessions
                        </th>
                        <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>
                          Avg Attention
                        </th>
                        <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                          Last Session
                        </th>
                        <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => (
                        <tr key={student.id} style={{ 
                          borderBottom: index < students.length - 1 ? '1px solid #e2e8f0' : 'none',
                          transition: 'background-color 0.2s'
                        }}>
                          <td style={{ padding: '16px' }}>
                            <div>
                              <div style={{ fontWeight: '600', color: '#1f2937' }}>
                                {student.name}
                              </div>
                              <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                                {student.email}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px', color: '#374151' }}>
                            {student.class}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'center', fontWeight: '600' }}>
                            {student.total_sessions}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'center' }}>
                            <span style={{ 
                              color: getAttentionColor(student.avg_attention),
                              fontWeight: '600'
                            }}>
                              {student.avg_attention}%
                            </span>
                          </td>
                          <td style={{ padding: '16px', fontSize: '0.9rem', color: '#6b7280' }}>
                            {formatTime(student.last_session)}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'center' }}>
                            <button
                              onClick={() => navigate(`/teacher/student/${student.id}/progress`)}
                              style={{
                                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '500'
                              }}
                            >
                              View Progress
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;