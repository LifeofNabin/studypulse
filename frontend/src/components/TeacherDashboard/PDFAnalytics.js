// frontend/src/components/TeacherDashboard/PDFAnalytics.js
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import io from 'socket.io-client';
import StudentDetailModal from './StudentDetailModal';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const PDFAnalytics = ({ room }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [realTimeUpdates, setRealTimeUpdates] = useState([]);

  useEffect(() => {
    if (!room) return;

    // Setup socket connection
    const newSocket = io(API_BASE_URL, {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    newSocket.on('connect', () => {
      console.log('📊 PDF Analytics socket connected');
      setSocketConnected(true);
      
      // Join teacher room for real-time updates
      newSocket.emit('join_room', { 
        room_id: `${room.id}_teachers`
      });

      // Request room analytics
      newSocket.emit('get_room_pdf_analytics', { room_id: room.id });
    });

    newSocket.on('room_pdf_analytics', (data) => {
      console.log('📊 Received room analytics:', data);
      setAnalytics(data.analytics);
      setLoading(false);
    });

    // Real-time updates
    newSocket.on('pdf_analytics_update', (data) => {
      console.log('📈 Real-time update:', data);
      setRealTimeUpdates(prev => [
        { ...data, timestamp: Date.now() },
        ...prev.slice(0, 9)
      ]);
      
      // Update analytics
      if (analytics) {
        const updatedStudents = analytics.studentAnalytics.map(s => 
          s.sessionId === data.sessionId 
            ? { ...s, patterns: data.analytics, lastUpdated: new Date() }
            : s
        );
        setAnalytics({
          ...analytics,
          studentAnalytics: updatedStudents
        });
      }
    });

    newSocket.on('student_highlight', (data) => {
      setRealTimeUpdates(prev => [
        { type: 'highlight', ...data, timestamp: Date.now() },
        ...prev.slice(0, 9)
      ]);
    });

    newSocket.on('student_annotation', (data) => {
      setRealTimeUpdates(prev => [
        { type: 'annotation', ...data, timestamp: Date.now() },
        ...prev.slice(0, 9)
      ]);
    });

    newSocket.on('student_struggling_alert', (data) => {
      setRealTimeUpdates(prev => [
        { type: 'alert', ...data, timestamp: Date.now() },
        ...prev.slice(0, 9)
      ]);
    });

    newSocket.on('room_pdf_analytics_error', (error) => {
      console.error('❌ Analytics error:', error);
      setLoading(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [room?.id]);

  const getEngagementColor = (level) => {
    switch(level) {
      case 'high': return '#22c55e';
      case 'medium': return '#f59e0b';
      case 'low': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getFocusColor = (quality) => {
    switch(quality) {
      case 'excellent': return '#22c55e';
      case 'good': return '#3b82f6';
      case 'fair': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: '60px',
        color: '#6b7280'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '1.2rem' }}>Loading PDF Analytics...</div>
        </div>
      </div>
    );
  }

  if (!analytics || !analytics.studentAnalytics || analytics.studentAnalytics.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '60px',
        background: '#f9fafb',
        borderRadius: '12px',
        border: '2px dashed #e5e7eb'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📚</div>
        <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>No PDF Activity Yet</h3>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Students haven't started interacting with study materials yet
        </p>
      </div>
    );
  }

  const { studentAnalytics, classInsights } = analytics;

  const engagementData = [
    { name: 'High', count: classInsights.engagementDistribution.high, fill: '#22c55e' },
    { name: 'Medium', count: classInsights.engagementDistribution.medium, fill: '#f59e0b' },
    { name: 'Low', count: classInsights.engagementDistribution.low, fill: '#ef4444' }
  ];

  const comprehensionData = studentAnalytics
    .filter(s => s.patterns?.comprehensionScore)
    .map(s => ({
      name: s.student?.name?.split(' ')[0] || 'Unknown',
      score: s.patterns.comprehensionScore
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div>
      {/* Connection Status */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        padding: '12px 16px',
        background: socketConnected ? '#d1fae5' : '#fee2e2',
        borderRadius: '8px',
        border: `1px solid ${socketConnected ? '#22c55e' : '#ef4444'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: socketConnected ? '#22c55e' : '#ef4444',
            animation: 'pulse 2s infinite'
          }}></div>
          <span style={{ fontWeight: '600', color: socketConnected ? '#065f46' : '#991b1b' }}>
            {socketConnected ? 'Real-time Updates Active' : 'Connecting...'}
          </span>
        </div>
        <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          {studentAnalytics.length} active sessions
        </span>
      </div>

      {/* Class Overview Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '8px' }}>Total Students</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{classInsights.totalStudents}</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
        }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '8px' }}>Avg Comprehension</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{Math.round(classInsights.avgComprehensionScore)}%</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
        }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '8px' }}>Avg Reading Speed</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{classInsights.avgReadingSpeed.toFixed(1)}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '4px' }}>pages/min</div>
        </div>

        <div style={{
          background: classInsights.strugglingStudents.length > 0 
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
        }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '8px' }}>
            {classInsights.strugglingStudents.length > 0 ? 'Struggling' : 'All Good'}
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{classInsights.strugglingStudents.length}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Engagement Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={engagementData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({name, count}) => `${name}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {engagementData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Comprehension Scores</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={comprehensionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="score" fill="#667eea" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Real-time Activity Feed */}
      {realTimeUpdates.length > 0 && (
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>📡 Live Activity Feed</h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {realTimeUpdates.map((update, idx) => (
              <div key={idx} style={{
                padding: '12px',
                marginBottom: '8px',
                background: update.type === 'alert' ? '#fee2e2' : '#f0f9ff',
                borderLeft: `4px solid ${
                  update.type === 'alert' ? '#ef4444' :
                  update.type === 'highlight' ? '#fbbf24' :
                  update.type === 'annotation' ? '#8b5cf6' : '#3b82f6'
                }`,
                borderRadius: '6px',
                fontSize: '0.9rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600' }}>
                    {update.type === 'highlight' && '🖍️ Highlight'}
                    {update.type === 'annotation' && '📝 Annotation'}
                    {update.type === 'alert' && '⚠️ Alert'}
                    {!update.type && '📊 Update'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    {new Date(update.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ color: '#374151' }}>
                  {update.type === 'highlight' && `Page ${update.page}: "${update.text?.substring(0, 50)}..."`}
                  {update.type === 'annotation' && `Page ${update.page}: Note added`}
                  {update.type === 'alert' && `Student struggling - Score: ${update.comprehensionScore}%`}
                  {!update.type && `Session updated`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student Details Table */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>📚 Student Reading Analytics</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Student</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Comprehension</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Engagement</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Focus</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Speed</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Highlights</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Notes</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {studentAnalytics.map((student, idx) => (
                <tr 
                  key={idx}
                  style={{ 
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                      {student.student?.name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      {student.student?.email}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      background: student.patterns?.comprehensionScore >= 70 ? '#d1fae5' :
                                 student.patterns?.comprehensionScore >= 40 ? '#fed7aa' : '#fee2e2',
                      color: student.patterns?.comprehensionScore >= 70 ? '#065f46' :
                             student.patterns?.comprehensionScore >= 40 ? '#92400e' : '#991b1b',
                      fontWeight: '600'
                    }}>
                      {student.patterns?.comprehensionScore || 0}%
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      color: getEngagementColor(student.patterns?.engagementLevel),
                      fontWeight: '600',
                      textTransform: 'capitalize'
                    }}>
                      {student.patterns?.engagementLevel || 'N/A'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      color: getFocusColor(student.patterns?.focusQuality),
                      fontWeight: '600',
                      textTransform: 'capitalize'
                    }}>
                      {student.patterns?.focusQuality || 'N/A'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>
                    {student.patterns?.readingSpeed?.toFixed(1) || 0} p/m
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>
                    🖍️ {student.highlights || 0}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>
                    📝 {student.annotations || 0}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => setSelectedStudent(student)}
                      style={{
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '500'
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStudent && (
        <StudentDetailModal 
          student={selectedStudent} 
          onClose={() => setSelectedStudent(null)} 
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default PDFAnalytics;