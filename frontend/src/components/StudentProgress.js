import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AIInsights from './AIInsights';
import aiService from '../services/aiService';
import './StudentProgress.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const StudentProgress = () => {
  const { user } = useAuth();
  const [progressData, setProgressData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [loading, setLoading] = useState(true);
  
  // AI Features State
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiSessionAnalysis, setAiSessionAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchProgressData();
  }, [selectedPeriod]);

  const fetchProgressData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/students/progress?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProgressData(data);
      } else {
        setProgressData(mockProgressData);
      }
    } catch (error) {
      console.error('Error fetching progress data:', error);
      setProgressData(mockProgressData);
    } finally {
      setLoading(false);
    }
  };

  // Analyze last session with AI
  const analyzeLastSession = async () => {
    if (!progressData || progressData.recentSessions.length === 0) return;

    setAiLoading(true);
    const lastSession = progressData.recentSessions[0];

    try {
      const result = await aiService.analyzeSession({
        duration: lastSession.duration,
        avgAttention: lastSession.avgAttention,
        avgFatigue: lastSession.avgFatigue,
        subject: lastSession.subject,
        metricsCount: 100
      });

      if (result.success) {
        setAiSessionAnalysis(result.analysis);
      }
    } catch (error) {
      console.error('AI Analysis Error:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const mockProgressData = {
    totalStudyTime: 2340,
    averageAttention: 72,
    averageFatigue: 35,
    totalSessions: 24,
    recentSessions: [
      { date: '2024-01-21', subject: 'Mathematics', duration: 45, avgAttention: 76, avgFatigue: 30 },
      { date: '2024-01-21', subject: 'Physics', duration: 60, avgAttention: 68, avgFatigue: 40 },
      { date: '2024-01-20', subject: 'Chemistry', duration: 50, avgAttention: 72, avgFatigue: 35 }
    ],
    subjectStats: [
      { subject: 'Mathematics', time: 840, sessions: 8, avgAttention: 75, avgFatigue: 32 },
      { subject: 'Physics', time: 720, sessions: 6, avgAttention: 68, avgFatigue: 38 },
      { subject: 'Chemistry', time: 480, sessions: 5, avgAttention: 70, avgFatigue: 35 },
      { subject: 'Biology', time: 300, sessions: 5, avgAttention: 73, avgFatigue: 30 }
    ],
    dailyStats: [
      { date: '2024-01-15', totalTime: 120, avgAttention: 75, sessions: 3 },
      { date: '2024-01-16', totalTime: 90, avgAttention: 68, sessions: 2 },
      { date: '2024-01-17', totalTime: 150, avgAttention: 72, sessions: 4 },
      { date: '2024-01-18', totalTime: 180, avgAttention: 70, sessions: 3 },
      { date: '2024-01-19', totalTime: 200, avgAttention: 74, sessions: 4 },
      { date: '2024-01-20', totalTime: 165, avgAttention: 76, sessions: 3 },
      { date: '2024-01-21', totalTime: 135, avgAttention: 69, sessions: 3 }
    ],
    goals: {
      dailyTarget: 180,
      weeklyTarget: 1260,
      targetAttention: 75
    },
    achievements: [
      { title: 'Study Streak', description: '7 days in a row!', icon: '🔥', earned: true },
      { title: 'Focus Master', description: 'Maintained 80%+ attention for 1 hour', icon: '🎯', earned: true },
      { title: 'Early Bird', description: 'Studied before 8 AM', icon: '🌅', earned: false },
      { title: 'Night Owl', description: 'Studied after 10 PM', icon: '🦉', earned: true }
    ]
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getAttentionColor = (score) => {
    if (score >= 75) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getFatigueColor = (score) => {
    if (score <= 30) return '#22c55e';
    if (score <= 50) return '#f59e0b';
    return '#ef4444';
  };

  const calculateWeeklyProgress = () => {
    if (!progressData) return 0;
    const weeklyTime = progressData.dailyStats.reduce((sum, day) => sum + day.totalTime, 0);
    return Math.min((weeklyTime / progressData.goals.weeklyTarget) * 100, 100);
  };

  if (loading) {
    return (
      <div className="progress-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your progress...</p>
        </div>
      </div>
    );
  }

  const data = progressData || mockProgressData;

  return (
    <div className="progress-container">
      {/* Header */}
      <div className="progress-header">
        <div>
          <h1>My Study Progress</h1>
          <p>Track your learning journey and performance metrics</p>
        </div>
        <div className="period-selector">
          <button 
            className={selectedPeriod === 'week' ? 'active' : ''}
            onClick={() => setSelectedPeriod('week')}
          >
            This Week
          </button>
          <button 
            className={selectedPeriod === 'month' ? 'active' : ''}
            onClick={() => setSelectedPeriod('month')}
          >
            This Month
          </button>
          <button 
            className={selectedPeriod === 'all' ? 'active' : ''}
            onClick={() => setSelectedPeriod('all')}
          >
            All Time
          </button>
        </div>
      </div>

      {/* AI Toggle Button */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <button
          onClick={() => setShowAIPanel(!showAIPanel)}
          style={{
            padding: '12px 24px',
            background: showAIPanel ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : '#e5e7eb',
            color: showAIPanel ? 'white' : 'black',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            boxShadow: showAIPanel ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
            transition: 'all 0.3s ease'
          }}
        >
          {showAIPanel ? '✓ ' : ''}AI Insights & Predictions
        </button>
      </div>

      {/* AI Insights Component */}
      {showAIPanel && (
        <div style={{
          background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
          padding: '24px',
          borderRadius: '16px',
          marginBottom: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <AIInsights progressData={data} />
          
          {/* Last Session AI Analysis */}
          <div style={{
            marginTop: '20px',
            background: 'white',
            padding: '20px',
            borderRadius: '12px'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '1.2rem', fontWeight: '600' }}>
              Last Session Analysis
            </h3>
            
            {!aiSessionAnalysis ? (
              <button
                onClick={analyzeLastSession}
                disabled={aiLoading}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: aiLoading ? 'wait' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                {aiLoading ? 'Analyzing...' : 'Analyze Last Session'}
              </button>
            ) : (
              <div>
                <div style={{
                  padding: '16px',
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}>
                  <p><strong>Effectiveness:</strong> {aiSessionAnalysis.effectiveness}</p>
                  <p><strong>Score:</strong> {aiSessionAnalysis.effectivenessScore}/100</p>
                </div>

                {aiSessionAnalysis.strengths && aiSessionAnalysis.strengths.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ color: '#22c55e', marginBottom: '8px' }}>Strengths:</h4>
                    <ul style={{ paddingLeft: '20px' }}>
                      {aiSessionAnalysis.strengths.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSessionAnalysis.improvements && aiSessionAnalysis.improvements.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ color: '#f59e0b', marginBottom: '8px' }}>Areas for Improvement:</h4>
                    <ul style={{ paddingLeft: '20px' }}>
                      {aiSessionAnalysis.improvements.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSessionAnalysis.recommendations && aiSessionAnalysis.recommendations.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ color: '#3b82f6', marginBottom: '8px' }}>Recommendations:</h4>
                    <ul style={{ paddingLeft: '20px' }}>
                      {aiSessionAnalysis.recommendations.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSessionAnalysis.nextSessionAdvice && (
                  <div style={{
                    padding: '12px',
                    background: '#dbeafe',
                    borderRadius: '6px',
                    marginTop: '12px'
                  }}>
                    <strong>Next Session Advice:</strong>
                    <p style={{ marginTop: '4px' }}>{aiSessionAnalysis.nextSessionAdvice}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">📚</div>
          <div className="metric-content">
            <h3>Total Study Time</h3>
            <div className="metric-value">{formatTime(data.totalStudyTime)}</div>
            <div className="metric-subtitle">{data.totalSessions} sessions</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎯</div>
          <div className="metric-content">
            <h3>Avg Attention</h3>
            <div className="metric-value" style={{ color: getAttentionColor(data.averageAttention) }}>
              {data.averageAttention}%
            </div>
            <div className="metric-subtitle">
              Target: {data.goals.targetAttention}%
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">😴</div>
          <div className="metric-content">
            <h3>Avg Fatigue</h3>
            <div className="metric-value" style={{ color: getFatigueColor(data.averageFatigue) }}>
              {data.averageFatigue}%
            </div>
            <div className="metric-subtitle">Lower is better</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🏆</div>
          <div className="metric-content">
            <h3>Weekly Goal</h3>
            <div className="metric-value">{calculateWeeklyProgress().toFixed(0)}%</div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${calculateWeeklyProgress()}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Subject-wise Breakdown */}
      <div className="section">
        <h2>Subject Performance</h2>
        <div className="subjects-grid">
          {data.subjectStats.map((subject, index) => (
            <div key={index} className="subject-card">
              <div className="subject-header">
                <h3>{subject.subject}</h3>
                <div className="subject-time">{formatTime(subject.time)}</div>
              </div>
              
              <div className="subject-stats">
                <div className="stat-row">
                  <span>Sessions:</span>
                  <span>{subject.sessions}</span>
                </div>
                <div className="stat-row">
                  <span>Avg Attention:</span>
                  <span style={{ color: getAttentionColor(subject.avgAttention) }}>
                    {subject.avgAttention}%
                  </span>
                </div>
                <div className="stat-row">
                  <span>Avg Fatigue:</span>
                  <span style={{ color: getFatigueColor(subject.avgFatigue) }}>
                    {subject.avgFatigue}%
                  </span>
                </div>
              </div>

              <div className="subject-progress">
                <div className="subject-bar">
                  <div 
                    className="subject-bar-fill"
                    style={{ 
                      width: `${(subject.time / Math.max(...data.subjectStats.map(s => s.time))) * 100}%`,
                      backgroundColor: getAttentionColor(subject.avgAttention)
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Activity Chart */}
      <div className="section">
        <h2>Daily Activity (Last 7 Days)</h2>
        <div className="chart-container">
          <div className="daily-chart">
            {data.dailyStats.map((day, index) => (
              <div key={index} className="day-column">
                <div className="day-bar-container">
                  <div 
                    className="day-bar"
                    style={{ 
                      height: `${(day.totalTime / Math.max(...data.dailyStats.map(d => d.totalTime))) * 100}%`,
                      backgroundColor: getAttentionColor(day.avgAttention)
                    }}
                    title={`${formatTime(day.totalTime)} - ${day.avgAttention}% attention`}
                  ></div>
                </div>
                <div className="day-label">
                  {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                </div>
                <div className="day-time">{formatTime(day.totalTime)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="section">
        <h2>Achievements</h2>
        <div className="achievements-grid">
          {data.achievements.map((achievement, index) => (
            <div 
              key={index} 
              className={`achievement-card ${achievement.earned ? 'earned' : 'locked'}`}
            >
              <div className="achievement-icon">{achievement.icon}</div>
              <div className="achievement-content">
                <h4>{achievement.title}</h4>
                <p>{achievement.description}</p>
              </div>
              {achievement.earned && <div className="achievement-badge">✓</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Study Insights */}
      <div className="section">
        <h2>Study Insights</h2>
        <div className="insights-grid">
          <div className="insight-card">
            <h4>🌟 Best Performance</h4>
            <p>Your highest attention score was <strong>76%</strong> on Saturday</p>
          </div>
          <div className="insight-card">
            <h4>📈 Improvement</h4>
            <p>Your average attention improved by <strong>8%</strong> this week</p>
          </div>
          <div className="insight-card">
            <h4>⏰ Peak Hours</h4>
            <p>You study best between <strong>9 AM - 11 AM</strong></p>
          </div>
          <div className="insight-card">
            <h4>💡 Recommendation</h4>
            <p>Try taking a 5-minute break every 25 minutes to reduce fatigue</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProgress;