import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const TeacherStudentProgress = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [studentData, setStudentData] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentProgress();
  }, [studentId, selectedPeriod]);

  const fetchStudentProgress = async () => {
    try {
      setLoading(true);
      // Fetch student info and progress data
      const [studentResponse, progressResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/teacher/students/${studentId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${API_BASE_URL}/api/teacher/students/${studentId}/progress?period=${selectedPeriod}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      if (studentResponse.ok) {
        const student = await studentResponse.json();
        setStudentData(student);
      }

      if (progressResponse.ok) {
        const progress = await progressResponse.json();
        setProgressData(progress);
      } else {
        // Mock data for development
        setStudentData({
          id: studentId,
          name: 'John Doe',
          email: 'john.doe@student.edu',
          class: '10th Grade',
          enrollment_date: '2024-01-15'
        });
        setProgressData(mockProgressData);
      }
    } catch (error) {
      console.error('Error fetching student progress:', error);
      setStudentData({
        id: studentId,
        name: 'John Doe',
        email: 'john.doe@student.edu',
        class: '10th Grade',
        enrollment_date: '2024-01-15'
      });
      setProgressData(mockProgressData);
    } finally {
      setLoading(false);
    }
  };

  const mockProgressData = {
    totalStudyTime: 2340,
    averageAttention: 72,
    averageFatigue: 35,
    totalSessions: 24,
    recentSessions: [
      { date: '2024-01-21', subject: 'Mathematics', duration: 45, avgAttention: 78, avgFatigue: 30 },
      { date: '2024-01-20', subject: 'Physics', duration: 60, avgAttention: 65, avgFatigue: 45 },
      { date: '2024-01-19', subject: 'Chemistry', duration: 40, avgAttention: 72, avgFatigue: 35 },
      { date: '2024-01-18', subject: 'Biology', duration: 55, avgAttention: 80, avgFatigue: 25 }
    ],
    subjectStats: [
      { subject: 'Mathematics', time: 840, sessions: 8, avgAttention: 75, avgFatigue: 32 },
      { subject: 'Physics', time: 720, sessions: 6, avgAttention: 68, avgFatigue: 38 },
      { subject: 'Chemistry', time: 480, sessions: 5, avgAttention: 70, avgFatigue: 35 },
      { subject: 'Biology', time: 300, sessions: 5, avgAttention: 73, avgFatigue: 30 }
    ],
    attentionTrend: [
      { date: '2024-01-15', score: 68 },
      { date: '2024-01-16', score: 72 },
      { date: '2024-01-17', score: 70 },
      { date: '2024-01-18', score: 75 },
      { date: '2024-01-19', score: 74 },
      { date: '2024-01-20', score: 65 },
      { date: '2024-01-21', score: 78 }
    ],
    alerts: [
      { date: '2024-01-20', type: 'attention', message: 'Low attention during Physics session', severity: 'warning' },
      { date: '2024-01-19', type: 'fatigue', message: 'High fatigue detected', severity: 'info' },
      { date: '2024-01-18', type: 'achievement', message: 'Excellent focus maintained for 1 hour', severity: 'success' }
    ]
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getScoreColor = (score, type = 'attention') => {
    if (type === 'attention') {
      if (score >= 75) return '#22c55e';
      if (score >= 60) return '#f59e0b';
      return '#ef4444';
    } else { // fatigue
      if (score <= 30) return '#22c55e';
      if (score <= 50) return '#f59e0b';
      return '#ef4444';
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'success': return '#22c55e';
      case 'warning': return '#f59e0b';
      case 'danger': return '#ef4444';
      default: return '#3b82f6';
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid rgba(96, 165, 250, 0.2)',
            borderTop: '4px solid #60a5fa',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Loading student progress...</p>
        </div>
      </div>
    );
  }

  const data = progressData || mockProgressData;
  const student = studentData;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      color: 'white',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '30px',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <button 
            onClick={() => navigate('/teacher')}
            style={{
              background: 'rgba(96, 165, 250, 0.2)',
              border: '1px solid rgba(96, 165, 250, 0.3)',
              color: '#60a5fa',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '16px'
            }}
          >
            ← Back to Dashboard
          </button>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            margin: '0',
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {student?.name} - Progress Report
          </h1>
          <div style={{ color: '#94a3b8', marginTop: '8px' }}>
            <p style={{ margin: '4px 0' }}>Class: {student?.class}</p>
            <p style={{ margin: '4px 0' }}>Email: {student?.email}</p>
            <p style={{ margin: '4px 0' }}>Enrolled: {new Date(student?.enrollment_date).toLocaleDateString()}</p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          background: 'rgba(30, 41, 59, 0.6)',
          borderRadius: '12px',
          padding: '4px',
          border: '1px solid rgba(148, 163, 184, 0.2)'
        }}>
          {['week', 'month', 'all'].map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              style={{
                background: selectedPeriod === period ? 'linear-gradient(135deg, #60a5fa, #a78bfa)' : 'none',
                border: 'none',
                color: selectedPeriod === period ? 'white' : '#94a3b8',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                textTransform: 'capitalize'
              }}
            >
              {period === 'all' ? 'All Time' : `This ${period}`}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '40px'
      }}>
        <div style={{
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase' }}>
            Total Study Time
          </h3>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#60a5fa' }}>
            {formatTime(data.totalStudyTime)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
            {data.totalSessions} sessions completed
          </div>
        </div>

        <div style={{
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase' }}>
            Average Attention
          </h3>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: getScoreColor(data.averageAttention) }}>
            {data.averageAttention}%
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
            Target: 75%
          </div>
        </div>

        <div style={{
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase' }}>
            Average Fatigue
          </h3>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: getScoreColor(data.averageFatigue, 'fatigue') }}>
            {data.averageFatigue}%
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
            Lower is better
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '20px' }}>Recent Sessions</h2>
        <div style={{
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
            padding: '16px 24px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            background: 'rgba(96, 165, 250, 0.1)',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}>
            <div>Date</div>
            <div>Subject</div>
            <div>Duration</div>
            <div>Attention</div>
            <div>Fatigue</div>
          </div>
          {data.recentSessions.map((session, index) => (
            <div key={index} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
              padding: '16px 24px',
              borderBottom: index < data.recentSessions.length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
              fontSize: '0.9rem'
            }}>
              <div>{new Date(session.date).toLocaleDateString()}</div>
              <div>{session.subject}</div>
              <div>{session.duration} min</div>
              <div style={{ color: getScoreColor(session.avgAttention) }}>
                {session.avgAttention}%
              </div>
              <div style={{ color: getScoreColor(session.avgFatigue, 'fatigue') }}>
                {session.avgFatigue}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subject Performance */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '20px' }}>Subject Performance</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {data.subjectStats.map((subject, index) => (
            <div key={index} style={{
              background: 'rgba(30, 41, 59, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '16px',
              padding: '20px'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
                {subject.subject}
              </h3>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Total Time:</span>
                  <span style={{ fontWeight: '600', color: '#60a5fa' }}>{formatTime(subject.time)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Sessions:</span>
                  <span>{subject.sessions}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Avg Attention:</span>
                  <span style={{ color: getScoreColor(subject.avgAttention) }}>
                    {subject.avgAttention}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Avg Fatigue:</span>
                  <span style={{ color: getScoreColor(subject.avgFatigue, 'fatigue') }}>
                    {subject.avgFatigue}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts & Notes */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '20px' }}>Recent Alerts</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.alerts.map((alert, index) => (
            <div key={index} style={{
              background: 'rgba(30, 41, 59, 0.6)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${getSeverityColor(alert.severity)}33`,
              borderRadius: '12px',
              padding: '16px',
              borderLeft: `4px solid ${getSeverityColor(alert.severity)}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>{alert.message}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {new Date(alert.date).toLocaleDateString()} - {alert.type}
                  </div>
                </div>
                <div style={{
                  background: getSeverityColor(alert.severity),
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  {alert.severity}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeacherStudentProgress;