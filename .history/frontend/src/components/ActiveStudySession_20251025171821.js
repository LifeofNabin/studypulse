// frontend/src/components/ActiveStudySession.js
import React, { useState, useEffect, useRef } from 'react';
import { Eye, Zap, Clock, Activity, Camera, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ActiveStudySession() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);
  
  const [metrics, setMetrics] = useState({
    attention: 75,
    fatigue: 30,
    faceDetected: true,
    blinkRate: 18,
    postureScore: 85,
    distractions: 0
  });

  const [elapsedTime, setElapsedTime] = useState(0);
  const [sessionData, setSessionData] = useState({
    attentionHistory: [],
    fatigueHistory: [],
    events: []
  });
  
  const timerRef = useRef(null);

  useEffect(() => {
    // Load goal from localStorage
    const activeGoal = localStorage.getItem('activeGoal');
    if (activeGoal) {
      setGoal(JSON.parse(activeGoal));
    } else {
      navigate('/student/goals');
    }

    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    // Simulate real-time metrics updates
    const metricsInterval = setInterval(() => {
      setMetrics(prev => {
        const newAttention = Math.max(0, Math.min(100, prev.attention + (Math.random() - 0.5) * 10));
        const newFatigue = Math.max(0, Math.min(100, prev.fatigue + (Math.random() - 0.3) * 5));
        
        // Store in history
        setSessionData(sd => ({
          ...sd,
          attentionHistory: [...sd.attentionHistory, newAttention],
          fatigueHistory: [...sd.fatigueHistory, newFatigue]
        }));

        return {
          ...prev,
          attention: newAttention,
          fatigue: newFatigue,
          blinkRate: Math.max(10, Math.min(30, prev.blinkRate + (Math.random() - 0.5) * 4)),
          postureScore: Math.max(0, Math.min(100, prev.postureScore + (Math.random() - 0.5) * 8))
        };
      });
    }, 3000);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(metricsInterval);
    };
  }, [navigate]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndSession = () => {
    const sessionReport = {
      goalId: goal.id,
      duration: elapsedTime,
      avgAttention: sessionData.attentionHistory.reduce((a, b) => a + b, 0) / sessionData.attentionHistory.length || 0,
      avgFatigue: sessionData.fatigueHistory.reduce((a, b) => a + b, 0) / sessionData.fatigueHistory.length || 0,
      currentSubject: goal.subjects[currentSubjectIndex].subject,
      timestamp: new Date().toISOString(),
      attentionHistory: sessionData.attentionHistory,
      fatigueHistory: sessionData.fatigueHistory,
      events: sessionData.events
    };

    // Save report
    localStorage.setItem('lastSessionReport', JSON.stringify(sessionReport));
    
    // Navigate back to goals
    navigate('/student/goals?showReport=true');
  };

  const getMetricColor = (value, reverse = false) => {
    if (reverse) {
      if (value < 30) return '#10b981';
      if (value < 60) return '#f59e0b';
      return '#ef4444';
    }
    if (value >= 75) return '#10b981';
    if (value >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getEngagementLevel = () => {
    if (metrics.attention >= 75) return { label: 'Excellent', color: '#10b981', emoji: '🌟' };
    if (metrics.attention >= 60) return { label: 'Good', color: '#3b82f6', emoji: '👍' };
    if (metrics.attention >= 40) return { label: 'Fair', color: '#f59e0b', emoji: '⚠️' };
    return { label: 'Poor', color: '#ef4444', emoji: '😴' };
  };

  if (!goal) return null;

  const engagement = getEngagementLevel();
  const currentSubject = goal.subjects[currentSubjectIndex];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header Bar */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '16px 24px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/student/goals')}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              width: 40,
              height: 40,
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px' }}>
              {goal.title}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
              Current: <span style={{ fontWeight: '600', color: '#60a5fa' }}>{currentSubject.subject}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>Session Time</div>
            <div style={{ color: 'white', fontSize: '1.75rem', fontWeight: '700', fontFamily: 'monospace' }}>
              {formatTime(elapsedTime)}
            </div>
          </div>
          <button 
            onClick={handleEndSession}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.2s'
            }}>
            🛑 End Session
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left Column - Video & Metrics */}
        <div>
          {/* Webcam Feed */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '20px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{
              background: '#1f2937',
              borderRadius: '12px',
              aspectRatio: '16/9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: `3px solid ${metrics.faceDetected ? '#10b981' : '#ef4444'}`
            }}>
              <Camera size={64} color="rgba(255,255,255,0.3)" />
              <div style={{
                position: 'absolute',
                top: 16,
                left: 16,
                background: metrics.faceDetected ? '#10b981' : '#ef4444',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.875rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'white',
                  animation: 'pulse 2s infinite'
                }} />
                {metrics.faceDetected ? 'Face Detected' : 'No Face'}
              </div>
            </div>
          </div>

          {/* Real-time Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px'
          }}>
            {[
              { icon: Eye, label: 'Attention', value: metrics.attention, suffix: '%', color: getMetricColor(metrics.attention) },
              { icon: Zap, label: 'Fatigue', value: metrics.fatigue, suffix: '%', color: getMetricColor(metrics.fatigue, true), reverse: true },
              { icon: Activity, label: 'Blink Rate', value: metrics.blinkRate, suffix: '/min', color: '#3b82f6' }
            ].map((metric, i) => {
              const Icon = metric.icon;
              return (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{
                      background: `${metric.color}20`,
                      width: 40,
                      height: 40,
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={20} color={metric.color} />
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', fontWeight: '500' }}>
                      {metric.label}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: metric.color }}>
                      {Math.round(metric.value)}
                    </div>
                    <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)' }}>
                      {metric.suffix}
                    </div>
                  </div>
                  <div style={{
                    marginTop: '12px',
                    background: 'rgba(255,255,255,0.1)',
                    height: 4,
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${metric.value}%`,
                      height: '100%',
                      background: metric.color,
                      borderRadius: 2,
                      transition: 'width 0.5s'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Engagement Status */}
          <div style={{
            background: engagement.color,
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{engagement.emoji}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white', marginBottom: '8px' }}>
              {engagement.label} Focus
            </div>
          </div>

          {/* Subject Selector */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '20px'
          }}>
            <h3 style={{ color: 'white', margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
              📚 Subjects
            </h3>
            {goal.subjects.map((subj, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSubjectIndex(idx)}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: '8px',
                  background: idx === currentSubjectIndex ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${idx === currentSubjectIndex ? subj.color : 'transparent'}`,
                  borderRadius: '10px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '600',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{subj.subject}</span>
                  <span style={{ opacity: 0.7 }}>{subj.hoursPerDay}h/day</span>
                </div>
              </button>
            ))}
          </div>

          {/* Alerts */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{ color: 'white', margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
              ⚠️ Alerts
            </h3>
            {metrics.fatigue > 70 && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '12px',
                display: 'flex',
                gap: '12px'
              }}>
                <AlertCircle size={20} color="#ef4444" />
                <div>
                  <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.9rem' }}>
                    High Fatigue
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginTop: '4px' }}>
                    Take a 5-min break
                  </div>
                </div>
              </div>
            )}
            {metrics.attention >= 75 && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid #10b981',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                gap: '12px'
              }}>
                <CheckCircle size={20} color="#10b981" />
                <div>
                  <div style={{ color: '#10b981', fontWeight: '600', fontSize: '0.9rem' }}>
                    Great Focus! 🎉
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}