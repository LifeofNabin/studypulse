import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMediaPipeFaceGaze } from '../hooks/useMediaPipeFaceGaze';
import io from 'socket.io-client';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const StudySession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socketRef = useRef(null);
  const wsRef = useRef(null);
  
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [metrics, setMetrics] = useState({
    totalTime: 0,
    averageAttention: 0,
    faceDetectedTime: 0,
    alertsCount: 0
  });
  const [alerts, setAlerts] = useState([]);
  
  const {
    videoRef,
    canvasRef,
    isModelLoaded,
    isCameraReady,
    gazeData,
    error,
    startDetection,
    stopDetection,
    processingTime
  } = useMediaPipeFaceGaze();

  // Initialize WebSocket connection
  useEffect(() => {
    if (sessionId && sessionActive) {
      const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws/${sessionId}`;
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
      };
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.status === 'received') {
          console.log('Metrics sent successfully');
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId, sessionActive]);

  // Send gaze data to backend
  useEffect(() => {
    if (gazeData && sessionActive && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const metricsData = {
        timestamp: gazeData.timestamp,
        face_present: gazeData.face_present,
        attention_score: gazeData.metrics?.attention_score || 0,
        head_pose: gazeData.headPose || { pitch: 0, yaw: 0, roll: 0 },
        gaze_direction: gazeData.gazeDirection || { x: 0, y: 0 },
        fatigue_level: gazeData.metrics?.fatigue_level || 0
      };
      
      wsRef.current.send(JSON.stringify(metricsData));
      
      // Update local metrics
      setMetrics(prev => ({
        ...prev,
        totalTime: prev.totalTime + 0.033, // ~30fps
        averageAttention: (prev.averageAttention + (gazeData.metrics?.attention_score || 0)) / 2,
        faceDetectedTime: gazeData.face_present ? prev.faceDetectedTime + 0.033 : prev.faceDetectedTime
      }));
      
      // Check for alerts
      if (gazeData.metrics) {
        if (gazeData.metrics.attention_score < 40) {
          addAlert('Low attention detected', 'warning');
        }
        if (gazeData.metrics.fatigue_level > 70) {
          addAlert('High fatigue level detected', 'danger');
        }
        if (!gazeData.face_present) {
          addAlert('Face not detected', 'info');
        }
      }
    }
  }, [gazeData, sessionActive]);

  const addAlert = (message, type) => {
    const newAlert = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setAlerts(prev => [newAlert, ...prev.slice(0, 9)]); // Keep last 10 alerts
    setMetrics(prev => ({ ...prev, alertsCount: prev.alertsCount + 1 }));
  };

  const startSession = async () => {
    if (!isModelLoaded || !isCameraReady) {
      alert('Please wait for camera and AI models to load');
      return;
    }
    
    setSessionActive(true);
    startDetection();
    addAlert('Study session started', 'success');
  };

  const endSession = async () => {
    setSessionActive(false);
    stopDetection();
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    try {
      await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Error ending session:', error);
    }
    
    navigate('/student');
  };

  const getAttentionColor = (score) => {
    if (score >= 70) return 'attention-good';
    if (score >= 40) return 'attention-medium';
    return 'attention-poor';
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="session-container">
      <div className="session-header">
        <div className="session-info">
          <h2>Study Session</h2>
          <p>Session ID: {sessionId}</p>
        </div>
        <div className="session-controls">
          {!sessionActive ? (
            <button
              onClick={startSession}
              disabled={!isModelLoaded || !isCameraReady}
              className="btn-session btn-start"
            >
              {!isModelLoaded ? 'Loading AI...' : !isCameraReady ? 'Initializing Camera...' : 'Start Session'}
            </button>
          ) : (
            <button onClick={endSession} className="btn-session btn-stop">
              End Session
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
          <strong>Error:</strong> {error}
          <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>
            Please ensure your browser supports WebGL and camera access.
          </p>
        </div>
      )}

      <div className="session-content">
        <div className="video-container">
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="video-feed"
            />
            <canvas
              ref={canvasRef}
              className="video-overlay"
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%',
                transform: 'scaleX(-1)' 
              }}
            />
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px',
            color: 'white'
          }}>
            <div className="metric-card">
              <div className="metric-label">Session Time</div>
              <div className="metric-value">{formatTime(metrics.totalTime)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Face Detection</div>
              <div className="metric-value">
                {metrics.totalTime > 0 ? ((metrics.faceDetectedTime / metrics.totalTime) * 100).toFixed(0) : 0}%
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Processing Time</div>
              <div className="metric-value">{processingTime.toFixed(1)}ms</div>
            </div>
          </div>
        </div>

        <div className="metrics-panel">
          <h3 style={{ marginBottom: '20px', color: 'white' }}>Real-time Metrics</h3>
          
          {gazeData && (
            <>
              <div className="metric-card">
                <div className="metric-label">Attention Score</div>
                <div className={`metric-value ${getAttentionColor(gazeData.metrics?.attention_score || 0)}`}>
                  {(gazeData.metrics?.attention_score || 0).toFixed(0)}%
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Head Pose</div>
                <div className="metric-value" style={{ fontSize: '1rem' }}>
                  P: {gazeData.headPose?.pitch?.toFixed(1) || 0}°<br/>
                  Y: {gazeData.headPose?.yaw?.toFixed(1) || 0}°<br/>
                  R: {gazeData.headPose?.roll?.toFixed(1) || 0}°
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Gaze Direction</div>
                <div className="metric-value" style={{ fontSize: '1rem' }}>
                  X: {gazeData.gazeDirection?.x?.toFixed(2) || 0}<br/>
                  Y: {gazeData.gazeDirection?.y?.toFixed(2) || 0}
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Fatigue Level</div>
                <div className={`metric-value ${gazeData.metrics?.fatigue_level > 70 ? 'attention-poor' : gazeData.metrics?.fatigue_level > 40 ? 'attention-medium' : 'attention-good'}`}>
                  {(gazeData.metrics?.fatigue_level || 0).toFixed(0)}%
                </div>
              </div>
            </>
          )}

          {alerts.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ marginBottom: '12px', color: 'white' }}>Recent Alerts</h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {alerts.map(alert => (
                  <div
                    key={alert.id}
                    className="metric-card"
                    style={{
                      background: alert.type === 'danger' ? 'rgba(239, 68, 68, 0.2)' :
                                 alert.type === 'warning' ? 'rgba(245, 158, 11, 0.2)' :
                                 alert.type === 'success' ? 'rgba(16, 185, 129, 0.2)' :
                                 'rgba(59, 130, 246, 0.2)',
                      fontSize: '0.9rem',
                      marginBottom: '8px'
                    }}
                  >
                    <div style={{ fontWeight: '600' }}>{alert.message}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{alert.timestamp}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudySession;