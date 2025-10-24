import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './StudentProgress.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const StudentProgress = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [student, setStudent] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('all'); // 'week', 'month', 'all'
  const [stats, setStats] = useState({
    totalStudyTime: 0,
    totalSessions: 0,
    avgAttention: 0,
    avgFatigue: 0,
    avgEngagement: 0,
  });
  const [subjectStats, setSubjectStats] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);

  useEffect(() => {
    fetchStudentData();
  }, [studentId, timeRange]);

  const fetchStudentData = async () => {
    setLoading(true);
    setError('');

    try {
      if (!user) {
        setError('Please log in to view student progress.');
        navigate('/login');
        return;
      }

      // Fetch student info
      const studentResponse = await axios.get(`${API_BASE_URL}/api/teacher/students`, {
        withCredentials: true,
      });

      const studentData = studentResponse.data.find((s) => s._id === studentId);
      if (!studentData) {
        setError('Student not found');
        setLoading(false);
        return;
      }
      setStudent(studentData);

      // Fetch student sessions (optimized endpoint)
      const sessionsResponse = await axios.get(
        `${API_BASE_URL}/api/teacher/students/${studentId}/sessions`,
        { withCredentials: true }
      );

      let allSessions = sessionsResponse.data;
      allSessions = allSessions.map((session) => ({
        ...session,
        room_title: session.room_title || 'Unknown',
        room_subject: session.room_subject || 'Unknown',
      }));
      allSessions.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

      // Filter by time range
      const filteredSessions = filterByTimeRange(allSessions, timeRange);
      setSessions(filteredSessions);

      // Fetch metrics for sessions
      let allMetrics = [];
      for (const session of filteredSessions) {
        try {
          const metricsResponse = await axios.get(
            `${API_BASE_URL}/api/sessions/${session._id}`,
            { withCredentials: true }
          );
          if (metricsResponse.data.metrics && metricsResponse.data.metrics.length > 0) {
            allMetrics = [
              ...allMetrics,
              ...metricsResponse.data.metrics.map((m) => ({
                ...m,
                session_id: session._id,
                subject: session.room_subject,
                timestamp: m.timestamp || new Date(session.start_time),
              })),
            ];
          }
        } catch (err) {
          console.error(`Error fetching metrics for session ${session._id}:`, err);
        }
      }
      setMetrics(allMetrics);

      // Calculate statistics
      calculateStats(filteredSessions, allMetrics);
      calculateSubjectStats(filteredSessions, allMetrics);
      generateAlerts(filteredSessions, allMetrics);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching student data:', error);
      if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        navigate('/login');
      } else {
        setError(error.response?.data?.detail || 'Failed to load student data. Please try again.');
      }
      setLoading(false);
    }
  };

  const filterByTimeRange = (sessions, range) => {
    const now = new Date();
    const cutoffDate = new Date();

    if (range === 'week') {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (range === 'month') {
      cutoffDate.setMonth(now.getMonth() - 1);
    } else {
      return sessions;
    }

    return sessions.filter((s) => new Date(s.start_time) >= cutoffDate);
  };

  const calculateStats = (sessions, metrics) => {
    if (sessions.length === 0) {
      setStats({
        totalStudyTime: 0,
        totalSessions: 0,
        avgAttention: 0,
        avgFatigue: 0,
        avgEngagement: 0,
      });
      return;
    }

    let totalMinutes = 0;
    sessions.forEach((session) => {
      const start = new Date(session.start_time);
      const end = session.end_time ? new Date(session.end_time) : new Date();
      const duration = (end - start) / 1000 / 60;
      totalMinutes += duration;
    });

    const avgAttention =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + (m.attention_score || 0), 0) / metrics.length
        : 0;

    const avgFatigue =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + (m.fatigue_level || 0), 0) / metrics.length
        : 0;

    const avgEngagement =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + (m.engagement_score || 0), 0) / metrics.length
        : 0;

    setStats({
      totalStudyTime: totalMinutes,
      totalSessions: sessions.length,
      avgAttention: avgAttention.toFixed(1),
      avgFatigue: avgFatigue.toFixed(1),
      avgEngagement: avgEngagement.toFixed(1),
    });
  };

  const calculateSubjectStats = (sessions, metrics) => {
    const subjectMap = {};

    sessions.forEach((session) => {
      const subject = session.room_subject || 'Unknown';
      if (!subjectMap[subject]) {
        subjectMap[subject] = {
          subject,
          totalTime: 0,
          sessions: 0,
          attentionScores: [],
          fatigueScores: [],
        };
      }

      const start = new Date(session.start_time);
      const end = session.end_time ? new Date(session.end_time) : new Date();
      const duration = (end - start) / 1000 / 60;

      subjectMap[subject].totalTime += duration;
      subjectMap[subject].sessions += 1;

      const sessionMetrics = metrics.filter((m) => m.session_id === session._id);
      sessionMetrics.forEach((m) => {
        if (m.attention_score) subjectMap[subject].attentionScores.push(m.attention_score);
        if (m.fatigue_level) subjectMap[subject].fatigueScores.push(m.fatigue_level);
      });
    });

    const subjectStatsArray = Object.values(subjectMap).map((s) => ({
      subject: s.subject,
      totalTime: s.totalTime,
      sessions: s.sessions,
      avgAttention: s.attentionScores.length > 0
        ? (s.attentionScores.reduce((a, b) => a + b, 0) / s.attentionScores.length).toFixed(1)
        : 0,
      avgFatigue: s.fatigueScores.length > 0
        ? (s.fatigueScores.reduce((a, b) => a + b, 0) / s.fatigueScores.length).toFixed(1)
        : 0,
    }));

    setSubjectStats(subjectStatsArray);
  };

  const generateAlerts = (sessions, metrics) => {
    const alerts = [];

    sessions.forEach((session) => {
      const sessionMetrics = metrics.filter((m) => m.session_id === session._id);
      if (sessionMetrics.length === 0) return;

      const avgAttention =
        sessionMetrics.reduce((sum, m) => sum + (m.attention_score || 0), 0) /
        sessionMetrics.length;
      const avgFatigue =
        sessionMetrics.reduce((sum, m) => sum + (m.fatigue_level || 0), 0) /
        sessionMetrics.length;

      if (avgAttention < 50) {
        alerts.push({
          message: `Low attention during ${session.room_subject} session`,
          date: session.start_time,
          type: 'warning',
          category: 'attention',
        });
      }

      if (avgFatigue > 70) {
        alerts.push({
          message: 'High fatigue detected',
          date: session.start_time,
          type: 'info',
          category: 'fatigue',
        });
      }

      if (avgAttention > 80) {
        const duration = session.end_time
          ? Math.floor((new Date(session.end_time) - new Date(session.start_time)) / 1000 / 60)
          : 0;
        if (duration > 30) {
          alerts.push({
            message: `Excellent focus maintained for ${duration} minutes`,
            date: session.start_time,
            type: 'success',
            category: 'achievement',
          });
        }
      }
    });

    alerts.sort((a, b) => new Date(b.date) - new Date(a.date));
    setRecentAlerts(alerts.slice(0, 10));
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'warning':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      case 'success':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✓';
      default:
        return '•';
    }
  };

  if (loading) {
    return (
      <div className="progress-loading">
        <div className="loading-spinner">Loading student progress...</div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="progress-error">
        <div className="error-message">{error || 'Student not found'}</div>
        <button onClick={() => navigate('/teacher')} className="btn-back">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="student-progress-container">
      {/* Header */}
      <div className="progress-header">
        <button onClick={() => navigate('/teacher')} className="btn-back-nav">
          ← Back to Dashboard
        </button>
        <div className="student-info-card">
          <h1 className="student-name">{student.name} - Progress Report</h1>
          <div className="student-details">
            <div><strong>Class:</strong> {student.class || 'N/A'}</div>
            <div><strong>Email:</strong> {student.email}</div>
            <div><strong>Enrolled:</strong> {formatDate(student.created_at)}</div>
          </div>
        </div>
      </div>

      {/* Time Range Filter */}
      <div className="time-range-filter">
        {['week', 'month', 'all'].map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`time-range-btn ${timeRange === range ? 'active' : ''}`}
          >
            {range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-blue">
          <div className="stat-label">Total Study Time</div>
          <div className="stat-value">{formatTime(stats.totalStudyTime)}</div>
          <div className="stat-detail">{stats.totalSessions} sessions completed</div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-label">Average Attention</div>
          <div className="stat-value">{stats.avgAttention}%</div>
          <div className="stat-detail">Target: 75%</div>
        </div>
        <div className="stat-card stat-orange">
          <div className="stat-label">Average Fatigue</div>
          <div className="stat-value">{stats.avgFatigue}%</div>
          <div className="stat-detail">Lower is better</div>
        </div>
        <div className="stat-card stat-purple">
          <div className="stat-label">Average Engagement</div>
          <div className="stat-value">{stats.avgEngagement}%</div>
          <div className="stat-detail">Overall performance</div>
        </div>
      </div>

      {/* Attention Over Time Chart */}
      {metrics.length > 0 && (
        <div className="section-card">
          <h2 className="section-title">Attention Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatDate} />
              <YAxis domain={[0, 100]} />
              <Tooltip labelFormatter={formatDateTime} />
              <Legend />
              <Line
                type="monotone"
                dataKey="attention_score"
                stroke="#3b82f6"
                name="Attention (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Sessions Table */}
      <div className="section-card">
        <h2 className="section-title">Recent Sessions</h2>
        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <p>No sessions found for the selected time range</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Duration</th>
                  <th>Attention</th>
                  <th>Fatigue</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 10).map((session) => {
                  const sessionMetrics = metrics.filter((m) => m.session_id === session._id);
                  const avgAttention =
                    sessionMetrics.length > 0
                      ? (
                          sessionMetrics.reduce((sum, m) => sum + (m.attention_score || 0), 0) /
                          sessionMetrics.length
                        ).toFixed(0)
                      : 'N/A';
                  const avgFatigue =
                    sessionMetrics.length > 0
                      ? (
                          sessionMetrics.reduce((sum, m) => sum + (m.fatigue_level || 0), 0) /
                          sessionMetrics.length
                        ).toFixed(0)
                      : 'N/A';
                  const duration = session.end_time
                    ? Math.floor(
                        (new Date(session.end_time) - new Date(session.start_time)) / 1000 / 60
                      )
                    : Math.floor((new Date() - new Date(session.start_time)) / 1000 / 60);

                  return (
                    <tr key={session._id}>
                      <td>{formatDateTime(session.start_time)}</td>
                      <td className="subject-cell">{session.room_subject}</td>
                      <td>{duration} min</td>
                      <td>
                        <span
                          className={`badge ${
                            avgAttention >= 70
                              ? 'badge-success'
                              : avgAttention >= 50
                              ? 'badge-warning'
                              : 'badge-danger'
                          }`}
                        >
                          {avgAttention}
                          {typeof avgAttention === 'number' ? '%' : ''}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            avgFatigue <= 40
                              ? 'badge-success'
                              : avgFatigue <= 60
                              ? 'badge-warning'
                              : 'badge-danger'
                          }`}
                        >
                          {avgFatigue}
                          {typeof avgFatigue === 'number' ? '%' : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subject Performance */}
      {subjectStats.length > 0 && (
        <div className="section-card">
          <h2 className="section-title">Subject Performance</h2>
          <div className="subject-grid">
            {subjectStats.map((subject, index) => (
              <div
                key={subject.subject}
                className="subject-card"
                style={{
                  background: `${COLORS[index % COLORS.length]}10`,
                  borderColor: `${COLORS[index % COLORS.length]}30`,
                }}
              >
                <h3 style={{ color: COLORS[index % COLORS.length] }}>{subject.subject}</h3>
                <div className="subject-stats">
                  <div className="subject-stat-row">
                    <span>Total Time:</span>
                    <strong>{formatTime(subject.totalTime)}</strong>
                  </div>
                  <div className="subject-stat-row">
                    <span>Sessions:</span>
                    <strong>{subject.sessions}</strong>
                  </div>
                  <div className="subject-stat-row">
                    <span>Avg Attention:</span>
                    <strong>{subject.avgAttention}%</strong>
                  </div>
                  <div className="subject-stat-row">
                    <span>Avg Fatigue:</span>
                    <strong>{subject.avgFatigue}%</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      {recentAlerts.length > 0 && (
        <div className="section-card">
          <h2 className="section-title">Recent Alerts</h2>
          <div className="alerts-list">
            {recentAlerts.map((alert, index) => (
              <div
                key={index}
                className="alert-item"
                style={{ borderLeftColor: getAlertColor(alert.type) }}
              >
                <div className="alert-icon">{getAlertIcon(alert.type)}</div>
                <div className="alert-content">
                  <div className="alert-message">{alert.message}</div>
                  <div className="alert-meta">
                    {formatDateTime(alert.date)} • {alert.category}
                  </div>
                </div>
                <div className="alert-badge" style={{ background: getAlertColor(alert.type) }}>
                  {alert.type}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProgress;