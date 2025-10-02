import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import io from 'socket.io-client';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const TeacherMonitoring = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socketRef = useRef(null);
  
  const [room, setRoom] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [liveMetrics, setLiveMetrics] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoomData();
    initializeSocket();

    // Poll for new sessions every 5 seconds
    const interval = setInterval(fetchSessions, 5000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId]);

  const fetchRoomData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const [roomsResponse, sessionsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/teacher/rooms`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/rooms/${roomId}/sessions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const roomData = roomsResponse.data.find(r => r.id === roomId);
      setRoom(roomData);
      setSessions(sessionsResponse.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching room data:', error);
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/rooms/${roomId}/sessions`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setSessions(response.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const initializeSocket = () => {
    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket', 'polling']
    });
    
    socketRef.current.on('connect', () => {
      console.log('Teacher connected to socket server');
      socketRef.current.emit('join_monitoring', { room_id: roomId });
    });

    socketRef.current.on('student_update', (data) => {
      console.log('Received student update:', data);
      setLiveMetrics(prev => ({
        ...prev,
        [data.session_id]: {
          ...data.metrics,
          timestamp: data.timestamp,
          lastUpdate: Date.now()
        }
      }));
    });

    socketRef.current.on('joined_room', (data) => {
      console.log('Joined monitoring room:', data.room_id);
    });
  };

  const getStatusColor = (sessionId) => {
    const metrics = liveMetrics[sessionId];
    if (!metrics) return 'status-offline';
    
    const lastUpdate = Date.now() - metrics.lastUpdate;
    if (lastUpdate > 10000) return 'status-offline';
    
    if (metrics.attention_score > 70) return 'status-online';
    if (metrics.attention_score > 40) return 'status-away';
    return 'status-offline';
  };

  const getEngagementLevel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div>Loading monitoring dashboard...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div>Room not found</div>
        <button onClick={() => navigate('/teacher')} style={{ marginTop: '20px' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <button
          onClick={() => navigate('/teacher')}
          style={{
            padding: '8px 16px',
            marginBottom: '16px',
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Back to Dashboard
        </button>
        
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem' }}>{room.title}</h1>
        <p style={{ margin: 0, color: '#6b7280' }}>
          {room.subject} • Room Code: <strong>{room.room_code}</strong>
        </p>
      </div>

      {/* Active Sessions */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{ margin: 0 }}>
            Live Student Monitoring ({sessions.length} students)
          </h2>
          <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>

        {sessions.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            color: '#6b7280'
          }}>
            <h3 style={{ marginBottom: '12px' }}>No Active Sessions</h3>
            <p>Students will appear here when they join and start their sessions.</p>
            <p style={{ marginTop: '16px' }}>
              Share the room code <strong>{room.room_code}</strong> with your students
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}>
            {sessions.map((session) => {
              const metrics = liveMetrics[session.id] || {};
              const statusColor = getStatusColor(session.id);
              
              return (
                <div key={session.id} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '20px',
                  background: '#f9fafb'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: statusColor === 'status-online' ? '#10b981' :
                                 statusColor === 'status-away' ? '#f59e0b' : '#6b7280'
                    }}></div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>
                        {session.student_name}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                        Started: {formatTimestamp(session.start_time)}
                      </p>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px'
                  }}>
                    <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                        {metrics.attention_score?.toFixed(0) || '--'}%
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Attention</div>
                    </div>

                    <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                        {metrics.fatigue_level?.toFixed(0) || '--'}%
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Fatigue</div>
                    </div>

                    <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                        {metrics.face_present ? 'Yes' : metrics.face_present === false ? 'No' : '--'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Face</div>
                    </div>

                    <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '8px' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                        {metrics.attention_score ? getEngagementLevel(metrics.attention_score) : '--'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Level</div>
                    </div>
                  </div>

                  {metrics.timestamp && (
                    <div style={{
                      marginTop: '12px',
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      textAlign: 'center'
                    }}>
                      Last: {formatTimestamp(metrics.timestamp)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {sessions.length > 0 && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px 0' }}>Session Summary</h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px'
          }}>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>
                {sessions.length}
              </div>
              <div style={{ color: '#6b7280' }}>Active Sessions</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#10b981' }}>
                {Object.values(liveMetrics).filter(m => m.attention_score > 70).length}
              </div>
              <div style={{ color: '#6b7280' }}>High Attention</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#f59e0b' }}>
                {Object.values(liveMetrics).filter(m => m.fatigue_level > 60).length}
              </div>
              <div style={{ color: '#6b7280' }}>High Fatigue</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#6366f1' }}>
                {Object.values(liveMetrics).filter(m => m.face_present).length}
              </div>
              <div style={{ color: '#6b7280' }}>Face Detected</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherMonitoring;