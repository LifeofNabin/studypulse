
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './TeacherDashboard.css';
import PDFAnalyticsTab from './TeacherDashboard/PDFAnalyticsTab';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const TeacherDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [newRoom, setNewRoom] = useState({
    title: '',
    subject: '',
    description: '',
    expected_duration: 60
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('rooms');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [selectedRoomForPdf, setSelectedRoomForPdf] = useState(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedRoomForAnalytics, setSelectedRoomForAnalytics] = useState(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to continue');
      if (window.location.pathname !== '/login') {
        navigate('/login');
      }
      return;
    }

    const initializeData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchRooms(), fetchAllStudents(), fetchStudentStats()]);
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };
    initializeData();
  }, []);

  const fetchRooms = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to continue');
      if (window.location.pathname !== '/login') {
        navigate('/login');
      }
      return;
    }
    try {
      console.log('Fetching rooms with API_BASE_URL:', API_BASE_URL);
      console.log('Token:', token ? 'Present' : 'Missing');
      const response = await axios.get(`${API_BASE_URL}/api/teacher/rooms`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Rooms fetched:', response.data);
      setRooms(response.data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
      } else {
        setError(error.response?.data?.detail || 'Failed to load rooms');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStudents = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to continue');
      if (window.location.pathname !== '/login') {
        navigate('/login');
      }
      return;
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/api/teacher/students`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setAllStudents(response.data);
    } catch (error) {
      console.error('Error fetching all students:', error);
      if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
      } else {
        setError(error.response?.data?.detail || 'Failed to load students');
      }
    }
  };

  const fetchStudentStats = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to continue');
      if (window.location.pathname !== '/login') {
        navigate('/login');
      }
      return;
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/api/teacher/students`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching student stats:', error);
      if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
      } else {
        setError(error.response?.data?.detail || 'Failed to load student stats');
      }
    }
  };

  // ... (rest of the code remains unchanged, including createRoom, addStudentToRoom, removeStudentFromRoom, handlePdfUpload, handleRemovePdf, deleteRoom, getAttentionColor, formatTime, getRoomStudents, getAvailableStudents, and the JSX)

  const createRoom = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to continue');
        navigate('/login');
        return;
      }
      const response = await axios.post(
        `${API_BASE_URL}/api/teacher/rooms`, 
        {
          title: newRoom.title,
          subject: newRoom.subject,
          description: newRoom.description,
          expected_duration: newRoom.expected_duration
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      setRooms([response.data, ...rooms]);
      setNewRoom({ title: '', subject: '', description: '', duration: 60 });
      setSuccess('Room created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Create room error:', error);
      if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setError(error.response?.data?.detail || 'Failed to create room');
      }
    }
  };

  const addStudentToRoom = async (roomId, studentId) => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to continue');
        navigate('/login');
        return;
      }
      const response = await axios.post(
        `${API_BASE_URL}/api/teacher/rooms/${roomId}/add-student`,
        { student_id: studentId },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      setRooms(rooms.map(room => {
        if (room.id === roomId) {
          return {
            ...room,
            allowed_students: [...(room.allowed_students || []), studentId],
            students_count: (room.students_count || 0) + 1
          };
        }
        return room;
      }));
      setSuccess('Student added to room successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Add student error:', error);
      if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setError(error.response?.data?.detail || 'Failed to add student');
      }
    }
  };

  const removeStudentFromRoom = async (roomId, studentId) => {
    if (!window.confirm('Remove this student from the room?')) return;
    try {
      setError('');
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to continue');
        navigate('/login');
        return;
      }
      await axios.delete(
        `${API_BASE_URL}/api/teacher/rooms/${roomId}/students/${studentId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      setRooms(rooms.map(room => {
        if (room.id === roomId) {
          return {
            ...room,
            allowed_students: (room.allowed_students || []).filter(id => id !== studentId),
            students_count: Math.max(0, (room.students_count || 0) - 1)
          };
        }
        return room;
      }));
      setSuccess('Student removed successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Remove student error:', error);
      if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setError('Failed to remove student');
      }
    }
  };

  const handlePdfUpload = async (roomId, file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size should be less than 10MB');
      return;
    }
    setUploadingPdf(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to continue');
        navigate('/login');
        return;
      }
      const formData = new FormData();
      formData.append('pdf', file);
      const response = await axios.post(
        `${API_BASE_URL}/api/teacher/rooms/${roomId}/upload-pdf`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      setRooms(rooms.map(room => 
        room.id === roomId 
          ? { ...room, pdf_file: response.data.pdf_file }
          : room
      ));
      setSelectedRoomForPdf(null);
      setSuccess('PDF uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Upload PDF error:', error);
      if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setError(error.response?.data?.detail || 'Failed to upload PDF');
      }
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleRemovePdf = async (roomId) => {
    if (!window.confirm('Are you sure you want to remove this PDF from the study room?')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to continue');
        navigate('/login');
        return;
      }
      await axios.delete(`${API_BASE_URL}/api/teacher/rooms/${roomId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setRooms(rooms.map(room => 
        room.id === roomId 
          ? { ...room, pdf_file: null }
          : room
      ));
      setSuccess('PDF removed successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Remove PDF error:', error);
      if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setError('Failed to remove PDF');
      }
    }
  };

  const deleteRoom = async (roomId) => {
    if (window.confirm('Are you sure you want to delete this room?')) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please log in to continue');
          navigate('/login');
          return;
        }
        await axios.delete(`${API_BASE_URL}/api/teacher/rooms/${roomId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setRooms(rooms.filter(room => room.id !== roomId));
        setSuccess('Room deleted successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        console.error('Delete room error:', error);
        if (error.response?.status === 401) {
          setError('Session expired. Please log in again.');
          localStorage.removeItem('token');
          navigate('/login');
        } else {
          setError('Failed to delete room');
        }
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

  const getRoomStudents = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room || !room.allowed_students) return [];
    return allStudents.filter(s => room.allowed_students.includes(s.id));
  };

  const getAvailableStudents = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return allStudents;
    const allowedIds = room.allowed_students || [];
    return allStudents.filter(s => !allowedIds.includes(s.id));
  };

  const filteredAvailableStudents = selectedRoom 
    ? getAvailableStudents(selectedRoom.id).filter(student =>
        student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        student.email.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : [];

  if (loading) {
    return (
      <div className="loading-spinner" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem',
        color: '#3b82f6'
      }}>
        Loading dashboard...
      </div>
    );
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
          <div style={{
            background: '#fee2e2',
            border: '1px solid #ef4444',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{error}</span>
            <button 
              onClick={() => setError('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#991b1b',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 8px'
              }}
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div style={{
            background: '#d1fae5',
            border: '1px solid #22c55e',
            color: '#065f46',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>✓ {success}</span>
            <button 
              onClick={() => setSuccess('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#065f46',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 8px'
              }}
            >
              ×
            </button>
          </div>
        )}

        <div style={{
          display: 'flex',
          borderBottom: '2px solid #e5e7eb',
          marginBottom: '24px',
          gap: '8px',
          overflowX: 'auto'
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
              fontSize: '1rem',
              whiteSpace: 'nowrap'
            }}
          >
            📚 Study Rooms ({rooms.length})
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
              fontSize: '1rem',
              whiteSpace: 'nowrap'
            }}
          >
            👨‍🎓 My Students ({students.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('pdf-analytics');
              setSelectedRoomForAnalytics(null);
            }}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'pdf-analytics' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'pdf-analytics' ? '#3b82f6' : '#6b7280',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem',
              whiteSpace: 'nowrap'
            }}
          >
            📊 PDF Analytics
          </button>
        </div>

        {activeTab === 'rooms' && (
          <div>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Create New Study Room</h3>
              </div>

              <form onSubmit={createRoom}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Room Title *</label>
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
                    <label className="form-label">Subject *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., Mathematics"
                      value={newRoom.subject}
                      onChange={(e) => setNewRoom({ ...newRoom, subject: e.target.value })}
                      required
                    />
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
                    value={newRoom.expected_duration}
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
              <h4 style={{ marginBottom: '16px', color: '#1a1a2e', fontSize: '1.3rem' }}>Active Study Rooms</h4>
              
              {rooms.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '60px 20px', 
                  background: '#f9fafb',
                  borderRadius: '12px',
                  border: '2px dashed #e5e7eb'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📚</div>
                  <p style={{ fontSize: '1.1rem', color: '#374151', marginBottom: '8px' }}>
                    No study rooms created yet
                  </p>
                  <p style={{ color: '#6b7280' }}>
                    Create your first room above to start monitoring students
                  </p>
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
                          <span style={{ color: '#6b7280' }}>Room Code:</span>
                          <span className="room-code" style={{ 
                            fontWeight: 'bold', 
                            color: '#3b82f6',
                            background: '#eff6ff',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontFamily: 'monospace'
                          }}>
                            {room.room_code}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: '#6b7280' }}>Enrolled Students:</span>
                          <span style={{ fontWeight: '600', color: '#1f2937' }}>
                            {room.students_count || 0}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: '#6b7280' }}>Status:</span>
                          <span style={{ 
                            color: room.status === 'active' ? '#22c55e' : '#f59e0b',
                            fontWeight: '600',
                            textTransform: 'capitalize'
                          }}>
                            ● {room.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#6b7280' }}>Created:</span>
                          <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                            {new Date(room.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div style={{
                        background: '#f0f9ff',
                        padding: '12px',
                        borderRadius: '6px',
                        marginTop: '16px',
                        border: '1px solid #bae6fd'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          marginBottom: '10px'
                        }}>
                          <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>
                            👥 Enrolled Students ({getRoomStudents(room.id).length})
                          </span>
                          <button
                            onClick={() => {
                              setSelectedRoom(room);
                              setShowAddStudentModal(true);
                              setStudentSearch('');
                            }}
                            style={{
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '600'
                            }}
                          >
                            + Add Student
                          </button>
                        </div>

                        <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                          {getRoomStudents(room.id).length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0, textAlign: 'center', padding: '10px' }}>
                              No students enrolled yet
                            </p>
                          ) : (
                            getRoomStudents(room.id).map(student => (
                              <div
                                key={student.id}
                                style={{
                                  background: 'white',
                                  padding: '8px',
                                  borderRadius: '4px',
                                  marginBottom: '6px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '0.85rem'
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '500', color: '#1f2937' }}>
                                    {student.name}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                    {student.email}
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeStudentFromRoom(room.id, student.id)}
                                  style={{
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    border: 'none',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: '500'
                                  }}
                                  title="Remove student from room"
                                >
                                  Remove
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div style={{
                        background: '#f8fafc',
                        padding: '12px',
                        borderRadius: '6px',
                        marginTop: '12px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          marginBottom: '8px'
                        }}>
                          <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>
                            📄 Study Material
                          </span>
                          {room.pdf_file && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              color: '#22c55e',
                              fontWeight: '600'
                            }}>
                              ✓ Uploaded
                            </span>
                          )}
                        </div>

                        {room.pdf_file ? (
                          <div>
                            <div style={{
                              background: 'white',
                              padding: '8px',
                              borderRadius: '4px',
                              marginBottom: '8px',
                              fontSize: '0.85rem'
                            }}>
                              <div style={{ fontWeight: '500', color: '#1f2937', marginBottom: '4px' }}>
                                {room.pdf_file.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                Uploaded: {new Date(room.pdf_file.uploaded_at).toLocaleString()}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemovePdf(room.id)}
                              style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                width: '100%'
                              }}
                            >
                              Remove PDF
                            </button>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="file"
                              accept=".pdf"
                              id={`pdf-upload-${room.id}`}
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handlePdfUpload(room.id, e.target.files[0]);
                                  e.target.value = ''; // Reset input after upload
                                }
                              }}
                              disabled={uploadingPdf}
                            />
                            <button
                              onClick={() => document.getElementById(`pdf-upload-${room.id}`).click()}
                              disabled={uploadingPdf}
                              style={{
                                background: uploadingPdf ? '#9ca3af' : '#8b5cf6',
                                color: 'white',
                                border: 'none',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                cursor: uploadingPdf ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem',
                                width: '100%',
                                fontWeight: '600'
                              }}
                            >
                              {uploadingPdf ? 'Uploading...' : '📤 Upload PDF'}
                            </button>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '6px' }}>
                              Max 10MB • PDF only
                            </div>
                          </div>
                        )}
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
                          📊 Monitor
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRoomForAnalytics(room);
                            setActiveTab('pdf-analytics');
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            flex: 1
                          }}
                        >
                          📈 Analytics
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
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

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
                <div style={{ 
                  textAlign: 'center', 
                  padding: '60px 20px',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  border: '2px dashed #e5e7eb'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👨‍🎓</div>
                  <p style={{ fontSize: '1.1rem', color: '#374151', marginBottom: '8px' }}>
                    No students enrolled yet
                  </p>
                  <p style={{ color: '#6b7280' }}>
                    Students will appear here after joining your study rooms
                  </p>
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
                        <tr 
                          key={student.id} 
                          style={{ 
                            borderBottom: index < students.length - 1 ? '1px solid #e2e8f0' : 'none',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
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
                              fontWeight: '600',
                              fontSize: '1.1rem'
                            }}>
                              {student.avg_attention}%
                            </span>
                          </td>
                          <td style={{ padding: '16px', fontSize: '0.9rem', color: '#6b7280' }}>
                            {student.last_session ? formatTime(student.last_session) : 'No sessions yet'}
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

        {activeTab === 'pdf-analytics' && (
          <PDFAnalyticsTab 
            rooms={rooms}
            selectedRoom={selectedRoomForAnalytics}
            setSelectedRoom={setSelectedRoomForAnalytics}
          />
        )}

        {showAddStudentModal && selectedRoom && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.3rem' }}>
                  Add Student to "{selectedRoom.title}"
                </h3>
                <button
                  onClick={() => {
                    setShowAddStudentModal(false);
                    setSelectedRoom(null);
                    setStudentSearch('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '28px',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '0',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  ×
                </button>
              </div>

              <input
                type="text"
                placeholder="🔍 Search students by name or email..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />

              <div style={{ marginBottom: '12px', color: '#6b7280', fontSize: '0.9rem' }}>
                Available students: {filteredAvailableStudents.length}
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredAvailableStudents.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '40px 20px',
                    color: '#6b7280',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    border: '2px dashed #e5e7eb'
                  }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
                    <p style={{ margin: 0 }}>
                      {studentSearch 
                        ? 'No students match your search' 
                        : 'All students are already enrolled in this room'}
                    </p>
                  </div>
                ) : (
                  filteredAvailableStudents.map(student => (
                    <div
                      key={student.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        border: '1px solid #e5e7eb',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#eff6ff';
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                          {student.name}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                          {student.email} {student.class && `• ${student.class}`}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          addStudentToRoom(selectedRoom.id, student.id);
                          setShowAddStudentModal(false);
                          setSelectedRoom(null);
                          setStudentSearch('');
                        }}
                        style={{
                          background: '#22c55e',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
