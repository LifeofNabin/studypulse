import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMediaPipeFaceGaze } from '../hooks/useMediaPipeFaceGaze';
import StudentPDFViewer from './StudentPDFViewer';
import io from 'socket.io-client';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const StudySession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socketRef = useRef(null);
  
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [roomId, setRoomId] = useState(null);
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

  // Fetch session data to get roomId
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setSessionData(data);
        setRoomId(data.room_id);
      } catch (error) {
        console.error('Error fetching session data:', error);
      }
    };

    if (sessionId) {
      fetchSessionData();
    }
  }, [sessionId]);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (sessionId && roomId && sessionActive) {
      // Create Socket.IO connection
      socketRef.current = io(API_BASE_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });
      
      socketRef.current.on('connect', () => {
        console.log('Socket.IO connected:', socketRef.current.id);
        
        // Join the room
        socketRef.current.emit('join_room', {
          room_id: roomId,
          session_id: sessionId
        });
      });
      
      socketRef.current.on('joined_room', (data) => {
        console.log('Successfully joined room:', data);
      });
      
      socketRef.current.on('student_update', (data) => {
        console.log('Received student update:', data);
      });
      
      socketRef.current.on('error', (error) => {
        console.error('Socket.IO error:', error);
      });
      
      socketRef.current.on('disconnect', () => {
        console.log('Socket.IO disconnected');
      });
    }
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [sessionId, roomId, sessionActive]);

  // Send gaze data to backend via Socket.IO
  useEffect(() => {
    if (gazeData && sessionActive && socketRef.current && socketRef.current.connected && roomId) {
      const metricsData = {
        session_id: sessionId,
        room_id: roomId,
        timestamp: gazeData.timestamp,
        facePresent: gazeData.face_present,
        faceAreaRatio: gazeData.metrics?.face_area_ratio || 0,
        gazeOnScreen: gazeData.metrics?.gaze_on_screen || 0,
        attentionScore: gazeData.metrics?.attention_score || 0,
        engagementScore: gazeData.metrics?.engagement_score || 0,
        blinkRate: gazeData.metrics?.blink_rate || 0,
        headPose: gazeData.headPose || { pitch: 0, yaw: 0, roll: 0 },
        gazeDirection: gazeData.gazeDirection || { x: 0, y: 0 },
        fatigueLevel: gazeData.metrics?.fatigue_level || 0
      };
      
      socketRef.current.emit('metric', metricsData);
      
      setMetrics(prev => ({
        ...prev,
        totalTime: prev.totalTime + 0.033,
        averageAttention: (prev.averageAttention + (gazeData.metrics?.attention_score || 0)) / 2,
        faceDetectedTime: gazeData.face_present ? prev.faceDetectedTime + 0.033 : prev.faceDetectedTime
      }));
      
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
  }, [gazeData, sessionActive, roomId]);

  const addAlert = (message, type) => {
    const newAlert = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setAlerts(prev => [newAlert, ...prev.slice(0, 9)]);
    setMetrics(prev => ({ ...prev, alertsCount: prev.alertsCount + 1 }));
  };

  const startSession = async () => {
    if (!isModelLoaded || !isCameraReady) {
      alert('Please wait for camera and AI models to load');
      return;
    }
    
    if (!roomId) {
      alert('Room information not loaded yet');
      return;
    }
    
    setSessionActive(true);
    startDetection();
    addAlert('Study session started', 'success');
  };

  const endSession = async () => {
    setSessionActive(false);
    stopDetection();
    
    if (socketRef.current) {
      socketRef.current.disconnect();
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
          {sessionData && <p>Room: {sessionData.room?.title}</p>}
        </div>
        <div className="session-controls">
          {!sessionActive ? (
            <button
              onClick={startSession}
              disabled={!isModelLoaded || !isCameraReady || !roomId}
              className="btn-session btn-start"
            >
              {!isModelLoaded ? 'Loading AI...' : !isCameraReady ? 'Initializing Camera...' : !roomId ? 'Loading Room...' : 'Start Session'}
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

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px',
        padding: '20px'
      }}>
        {/* Left Side - Camera and Metrics */}
        <div>
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
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '12px',
              marginBottom: '20px'
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
                <div className="metric-label">Processing</div>
                <div className="metric-value">{processingTime.toFixed(1)}ms</div>
              </div>
            </div>
          </div>

          <div className="metrics-panel">
            <h3 style={{ marginBottom: '16px', color: 'white' }}>Real-time Metrics</h3>
            
            {gazeData && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="metric-card">
                  <div className="metric-label">Attention Score</div>
                  <div className={`metric-value ${getAttentionColor(gazeData.metrics?.attention_score || 0)}`}>
                    {(gazeData.metrics?.attention_score || 0).toFixed(0)}%
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">Fatigue Level</div>
                  <div className={`metric-value ${gazeData.metrics?.fatigue_level > 70 ? 'attention-poor' : gazeData.metrics?.fatigue_level > 40 ? 'attention-medium' : 'attention-good'}`}>
                    {(gazeData.metrics?.fatigue_level || 0).toFixed(0)}%
                  </div>
                </div>
              </div>
            )}

            {alerts.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ marginBottom: '8px', color: 'white', fontSize: '0.9rem' }}>Recent Alerts</h4>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {alerts.slice(0, 3).map(alert => (
                    <div
                      key={alert.id}
                      className="metric-card"
                      style={{
                        background: alert.type === 'danger' ? 'rgba(239, 68, 68, 0.2)' :
                                   alert.type === 'warning' ? 'rgba(245, 158, 11, 0.2)' :
                                   alert.type === 'success' ? 'rgba(16, 185, 129, 0.2)' :
                                   'rgba(59, 130, 246, 0.2)',
                        fontSize: '0.85rem',
                        marginBottom: '6px',
                        padding: '8px'
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>{alert.message}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{alert.timestamp}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - PDF Viewer */}
        <div style={{ height: '80vh', overflow: 'hidden' }}>
          {roomId ? (
            <StudentPDFViewer 
              roomId={roomId} 
              sessionId={sessionId} 
            />
          ) : (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              Loading study material...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudySession;