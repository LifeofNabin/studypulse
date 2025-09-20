import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import io from 'socket.io-client';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const TeacherMonitoring = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [liveMetrics, setLiveMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetchRoomData();
    initializeSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [roomId]);

  const fetchRoomData = async () => {
    try {
      const [roomResponse, sessionsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/rooms`),
        axios.get(`${API_BASE_URL}/api/rooms/${roomId}/sessions`)
      ]);

      const roomData = roomResponse.data.find(r => r.id === roomId);
      setRoom(roomData);
      setSessions(sessionsResponse.data);
    } catch (error) {
      console.error('Error fetching room data:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeSocket = () => {
    const newSocket = io(API_BASE_URL);
    
    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      newSocket.emit('join_monitoring', { room_id: roomId });
    });

    newSocket.on('student_update', (data) => {
      setLiveMetrics(prev => ({
        ...prev,
        [data.session_id]: {
          ...data.metrics,
          timestamp: data.timestamp,
          lastUpdate: Date.now()
        }
      }));
    });

    newSocket.on('joined_room', (data) => {
      console.log('Joined monitoring room:', data.room_id);
    });

    setSocket(newSocket);
  };

  const getStatusColor = (sessionId) => {
    const metrics = liveMetrics[sessionId];
    if (!metrics) return 'status-offline';
    
    const lastUpdate = Date.now() - metrics.lastUpdate;
    if (lastUpdate > 10000) return 'status-offline'; // 10 seconds
    
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
    return <div className="loading-spinner">Loading monitoring dashboard...</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate('/teacher')}
              className="btn-secondary"
              style={{ padding: '8px 16px' }}
            >
              ← Back
            </button>
            <div className="dashboard-logo">StudyGuardian Monitoring</div>
          </div>
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span>{user?.name}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {room && (
          <div style={{ marginBottom: '32px' }}>
            <div className="dashboard-title">{room.title}</div>
            <div className="dashboard-subtitle">
              {room.subject} • Room Code: <span className="room-code">{room.room_code}</span>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              Live Student Monitoring ({sessions.length} students)
            </h3>
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
              <h4 style={{ marginBottom: '12px' }}>No Active Sessions</h4>
              <p>Students will appear here when they join the study room and start their sessions.</p>
              <p style={{ marginTop: '16px' }}>
                Share the room code <span className="room-code">{room?.room_code}</span> with your students
              </p>
            </div>
          ) : (
            <div className="monitoring-grid">
              {sessions.map((session) => {
                const metrics = liveMetrics[session.id] || {};
                const statusColor = getStatusColor(session.id);
                
                return (
                  <div key={session.id} className="student-monitor-card">
                    <div className="student-status">
                      <div className={`status-indicator ${statusColor}`}></div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem' }}>
                          {session.student_name || 'Unknown Student'}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
                          Started: {formatTimestamp(session.start_time)}
                        </p>
                      </div>
                    </div>

                    <div className="student-metrics">
                      <div className="mini-metric">
                        <div className="mini-metric-value">
                          {metrics.attention_score?.toFixed(0) || '--'}%
                        </div>
                        <div className="mini-metric-label">Attention</div>
                      </div>

                      <div className="mini-metric">
                        <div className="mini-metric-value">
                          {metrics.fatigue_level?.toFixed(0) || '--'}%
                        </div>
                        <div className="mini-metric-label">Fatigue</div>
                      </div>

                      <div className="mini-metric">
                        <div className="mini-metric-value">
                          {metrics.face_present ? 'Yes' : metrics.face_present === false ? 'No' : '--'}
                        </div>
                        <div className="mini-metric-label">Face Detected</div>
                      </div>

                      <div className="mini-metric">
                        <div className="mini-metric-value">
                          {metrics.attention_score ? getEngagementLevel(metrics.attention_score) : '--'}
                        </div>
                        <div className="mini-metric-label">Engagement</div>
                      </div>
                    </div>

                    {metrics.head_pose && (
                      <div style={{ 
                        marginTop: '16px', 
                        padding: '12px', 
                        background: '#f8fafc', 
                        borderRadius: '8px',
                        fontSize: '0.85rem'
                      }}>
                        <strong>Head Pose:</strong><br/>
                        Pitch: {metrics.head_pose.pitch?.toFixed(1)}° | 
                        Yaw: {metrics.head_pose.yaw?.toFixed(1)}° | 
                        Roll: {metrics.head_pose.roll?.toFixed(1)}°
                      </div>
                    )}

                    {metrics.gaze_direction && (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '12px', 
                        background: '#f0f9ff', 
                        borderRadius: '8px',
                        fontSize: '0.85rem'
                      }}>
                        <strong>Gaze:</strong> 
                        X: {metrics.gaze_direction.x?.toFixed(2)} | 
                        Y: {metrics.gaze_direction.y?.toFixed(2)}
                      </div>
                    )}

                    {metrics.timestamp && (
                      <div style={{ 
                        marginTop: '12px', 
                        fontSize: '0.8rem', 
                        color: '#6b7280',
                        textAlign: 'center'
                      }}>
                        Last update: {formatTimestamp(metrics.timestamp)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {sessions.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Session Summary</h3>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '20px' 
            }}>
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1a1a2e' }}>
                  {sessions.length}
                </div>
                <div style={{ color: '#6b7280' }}>Active Sessions</div>
              </div>
              
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981' }}>
                  {Object.values(liveMetrics).filter(m => m.attention_score > 70).length}
                </div>
                <div style={{ color: '#6b7280' }}>High Attention</div>
              </div>
              
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b' }}>
                  {Object.values(liveMetrics).filter(m => m.fatigue_level > 60).length}
                </div>
                <div style={{ color: '#6b7280' }}>High Fatigue</div>
              </div>
              
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#6366f1' }}>
                  {Object.values(liveMetrics).filter(m => m.face_present).length}
                </div>
                <div style={{ color: '#6b7280' }}>Face Detected</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherMonitoring;