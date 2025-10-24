import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import io from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

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
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentHistory, setStudentHistory] = useState([]);
  const [metricsHistory, setMetricsHistory] = useState({});

  useEffect(() => {
    fetchRoomData();
    initializeSocket();

    const interval = setInterval(fetchSessions, 5000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentDetailedMetrics(selectedStudent.id);
    }
  }, [selectedStudent]);

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

  const fetchStudentDetailedMetrics = async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/sessions/${sessionId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setStudentHistory(response.data.metrics || []);
      
      // Process metrics for charts
      const processedMetrics = (response.data.metrics || []).map((m, index) => ({
        time: new Date(m.timestamp).toLocaleTimeString(),
        attention: m.attention_score,
        fatigue: m.fatigue_level,
        engagement: m.engagement_score,
        blinkRate: m.blink_rate
      }));
      
      setMetricsHistory(prev => ({
        ...prev,
        [sessionId]: processedMetrics
      }));
    } catch (error) {
      console.error('Error fetching student metrics:', error);
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
    if (!metrics) return '#6b7280';
    
    const lastUpdate = Date.now() - metrics.lastUpdate;
    if (lastUpdate > 10000) return '#6b7280';
    
    if (metrics.attention_score > 70) return '#10b981';
    if (metrics.attention_score > 40) return '#f59e0b';
    return '#ef4444';
  };

  const getEngagementLevel = (score) => {
    if (score >= 80) return { level: 'Excellent', color: '#10b981' };
    if (score >= 60) return { level: 'Good', color: '#3b82f6' };
    if (score >= 40) return { level: 'Fair', color: '#f59e0b' };
    return { level: 'Poor', color: '#ef4444' };
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (startTime) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000 / 60);
    return `${diff} min`;
  };

  const calculateAverages = (sessionId) => {
    const history = metricsHistory[sessionId] || [];
    if (history.length === 0) return { attention: 0, fatigue: 0, engagement: 0 };
    
    const sum = history.reduce((acc, m) => ({
      attention: acc.attention + (m.attention || 0),
      fatigue: acc.fatigue + (m.fatigue || 0),
      engagement: acc.engagement + (m.engagement || 0)
    }), { attention: 0, fatigue: 0, engagement: 0 });
    
    return {
      attention: (sum.attention / history.length).toFixed(1),
      fatigue: (sum.fatigue / history.length).toFixed(1),
      engagement: (sum.engagement / history.length).toFixed(1)
    };
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.2rem', color: '#3b82f6' }}>Loading monitoring dashboard...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Room not found</div>
        <button 
          onClick={() => navigate('/teacher')}
          style={{
            padding: '12px 24px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto', background: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <button
          onClick={() => navigate('/teacher')}
          style={{
            padding: '8px 16px',
            marginBottom: '16px',
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '500'
          }}
        >
          ← Back to Dashboard
        </button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', color: '#1f2937' }}>{room.title}</h1>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>
              {room.subject} • Room Code: <strong style={{ color: '#3b82f6' }}>{room.room_code}</strong>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>
              Last updated: {new Date().toLocaleTimeString()}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#3b82f6' }}>
              {sessions.length} Active {sessions.length === 1 ? 'Student' : 'Students'}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {sessions.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '24px'
        }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #10b981, #059669)', 
            color: 'white', 
            padding: '24px', 
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '8px' }}>Active Sessions</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{sessions.length}</div>
          </div>
          
          <div style={{ 
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
            color: 'white', 
            padding: '24px', 
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '8px' }}>High Attention</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>
              {Object.values(liveMetrics).filter(m => m.attention_score > 70).length}
            </div>
          </div>
          
          <div style={{ 
            background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
            color: 'white', 
            padding: '24px', 
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '8px' }}>High Fatigue</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>
              {Object.values(liveMetrics).filter(m => m.fatigue_level > 60).length}
            </div>
          </div>
          
          <div style={{ 
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', 
            color: 'white', 
            padding: '24px', 
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '8px' }}>Face Detected</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>
              {Object.values(liveMetrics).filter(m => m.face_present).length}
            </div>
          </div>
        </div>
      )}

      {/* Active Sessions Grid */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', color: '#1f2937' }}>
          Live Student Monitoring
        </h2>

        {sessions.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '80px 20px',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📚</div>
            <h3 style={{ marginBottom: '12px', color: '#374151' }}>No Active Sessions</h3>
            <p style={{ fontSize: '1rem', marginBottom: '8px' }}>Students will appear here when they join and start their sessions.</p>
            <p style={{ marginTop: '16px', fontSize: '1.1rem' }}>
              Share the room code <strong style={{ color: '#3b82f6', fontSize: '1.3rem' }}>{room.room_code}</strong> with your students
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: '20px'
          }}>
            {sessions.map((session) => {
              const metrics = liveMetrics[session.id] || {};
              const statusColor = getStatusColor(session.id);
              const engagement = getEngagementLevel(metrics.attention_score || 0);
              
              return (
                <div 
                  key={session.id} 
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '20px',
                    background: 'linear-gradient(to bottom, #ffffff, #f9fafb)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                  onClick={() => setSelectedStudent(session)}
                >
                  {/* Status Indicator */}
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: statusColor,
                    boxShadow: `0 0 0 3px ${statusColor}33`,
                    animation: statusColor !== '#6b7280' ? 'pulse 2s infinite' : 'none'
                  }}></div>

                  {/* Student Info */}
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: '#1f2937' }}>
                      {session.student_name}
                    </h4>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      Started: {formatTimestamp(session.start_time)} • Duration: {formatDuration(session.start_time)}
                    </div>
                  </div>

                  {/* Engagement Badge */}
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    background: `${engagement.color}15`,
                    color: engagement.color,
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    marginBottom: '16px'
                  }}>
                    {engagement.level} Engagement
                  </div>

                  {/* Metrics Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '16px', 
                      background: 'white', 
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#3b82f6' }}>
                        {metrics.attention_score?.toFixed(0) || '--'}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>Attention</div>
                    </div>

                    <div style={{ 
                      textAlign: 'center', 
                      padding: '16px', 
                      background: 'white', 
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#f59e0b' }}>
                        {metrics.fatigue_level?.toFixed(0) || '--'}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>Fatigue</div>
                    </div>

                    <div style={{ 
                      textAlign: 'center', 
                      padding: '16px', 
                      background: 'white', 
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: '700', color: metrics.face_present ? '#10b981' : '#ef4444' }}>
                        {metrics.face_present ? '✓' : '✗'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>Face Present</div>
                    </div>

                    <div style={{ 
                      textAlign: 'center', 
                      padding: '16px', 
                      background: 'white', 
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#8b5cf6' }}>
                        {metrics.blink_rate?.toFixed(0) || '--'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>Blink/min</div>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStudent(session);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      marginTop: '8px'
                    }}
                  >
                    📊 View Detailed Insights
                  </button>

                  {metrics.timestamp && (
                    <div style={{
                      marginTop: '12px',
                      fontSize: '0.7rem',
                      color: '#9ca3af',
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

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '1200px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '1.8rem', color: '#1f2937' }}>
                  {selectedStudent.student_name}
                </h2>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  Session started: {formatTimestamp(selectedStudent.start_time)}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '24px',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Current Metrics */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ marginBottom: '16px', color: '#1f2937' }}>Current Metrics</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px'
              }}>
                {[
                  { label: 'Attention Score', value: liveMetrics[selectedStudent.id]?.attention_score?.toFixed(0) || '--', unit: '%', color: '#3b82f6' },
                  { label: 'Fatigue Level', value: liveMetrics[selectedStudent.id]?.fatigue_level?.toFixed(0) || '--', unit: '%', color: '#f59e0b' },
                  { label: 'Engagement', value: liveMetrics[selectedStudent.id]?.engagement_score?.toFixed(0) || '--', unit: '%', color: '#10b981' },
                  { label: 'Blink Rate', value: liveMetrics[selectedStudent.id]?.blink_rate?.toFixed(0) || '--', unit: '/min', color: '#8b5cf6' },
                  { label: 'Face Present', value: liveMetrics[selectedStudent.id]?.face_present ? 'Yes' : 'No', unit: '', color: liveMetrics[selectedStudent.id]?.face_present ? '#10b981' : '#ef4444' }
                ].map((metric, idx) => (
                  <div key={idx} style={{
                    background: `${metric.color}10`,
                    padding: '20px',
                    borderRadius: '12px',
                    border: `2px solid ${metric.color}30`,
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>
                      {metric.label}
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: metric.color }}>
                      {metric.value}{metric.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Charts */}
            {metricsHistory[selectedStudent.id] && metricsHistory[selectedStudent.id].length > 0 && (
              <div>
                <h3 style={{ marginBottom: '16px', color: '#1f2937' }}>Performance Trends</h3>
                
                {/* Attention & Engagement Chart */}
                <div style={{ 
                  background: '#f9fafb', 
                  padding: '20px', 
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#374151' }}>Attention & Engagement Over Time</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={metricsHistory[selectedStudent.id]}>
                      <defs>
                        <linearGradient id="colorAttention" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: '0.75rem' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '0.75rem' }} />
                      <Tooltip 
                        contentStyle={{ 
                          background: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '12px'
                        }}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="attention" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorAttention)" name="Attention %" />
                      <Area type="monotone" dataKey="engagement" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorEngagement)" name="Engagement %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Fatigue & Blink Rate Chart */}
                <div style={{ 
                  background: '#f9fafb', 
                  padding: '20px', 
                  borderRadius: '12px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#374151' }}>Fatigue & Blink Rate</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={metricsHistory[selectedStudent.id]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: '0.75rem' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '0.75rem' }} />
                      <Tooltip 
                        contentStyle={{ 
                          background: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '12px'
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="fatigue" stroke="#f59e0b" strokeWidth={2} name="Fatigue %" />
                      <Line type="monotone" dataKey="blinkRate" stroke="#8b5cf6" strokeWidth={2} name="Blink Rate" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Session Summary */}
            <div style={{
              marginTop: '32px',
              padding: '20px',
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              borderRadius: '12px',
              border: '2px solid #bfdbfe'
            }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#1e40af' }}>Session Summary</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>Duration</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e40af' }}>
                    {formatDuration(selectedStudent.start_time)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>Avg Attention</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e40af' }}>
                    {calculateAverages(selectedStudent.id).attention}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>Avg Fatigue</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e40af' }}>
                    {calculateAverages(selectedStudent.id).fatigue}%
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px',
              paddingTop: '24px',
              borderTop: '2px solid #e5e7eb'
            }}>
              <button
                onClick={() => {
                  fetchStudentDetailedMetrics(selectedStudent.id);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                🔄 Refresh Data
              </button>
              <button
                onClick={() => setSelectedStudent(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default TeacherMonitoring;