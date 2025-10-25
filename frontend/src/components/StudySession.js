import PresenceVerificationModal from './PresenceVerificationModal';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useEnhancedFaceDetection from '../hooks/useEnhancedFaceDetection';
import StudentPDFViewer from './StudentPDFViewer';
import io from 'socket.io-client';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const StudySession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const sessionStartTimeRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [showPresenceCheck, setShowPresenceCheck] = useState(false);
  const [presenceCheckData, setPresenceCheckData] = useState(null);
  const presenceCheckInterval = useRef(null);

  const [sessionActive, setSessionActive] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [hasPdf, setHasPdf] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [showMetricsPanel, setShowMetricsPanel] = useState(true);
  
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfSuccess, setPdfSuccess] = useState('');
  const [pdfRefreshKey, setPdfRefreshKey] = useState(0);
  
  const [aggregateMetrics, setAggregateMetrics] = useState({
    avgAttention: 0,
    avgFatigue: 0,
    faceDetectionRate: 0,
    totalDistractions: 0,
    peakAttention: 0,
    lowestAttention: 100
  });

  const [alerts, setAlerts] = useState([]);
  const [performanceHistory, setPerformanceHistory] = useState([]);

  const { metrics, isInitialized } = useEnhancedFaceDetection(videoRef, sessionActive);

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setCameraReady(true);
        }
      } catch (error) {
        console.error('Camera initialization error:', error);
        addAlert('Camera access denied. Please allow camera access.', 'danger');
      }
    };

    initCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Fetch session and room data
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const token = localStorage.getItem('student_token') || localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/sessions/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = response.data;
        setSessionData(data);
        
        if (data.room_id) {
          setRoomId(data.room_id);
          // Fetch room details to check for PDF
          const roomResponse = await axios.get(`${API_BASE_URL}/api/rooms/${data.room_id}/pdf-info`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setHasPdf(roomResponse.data.has_pdf);
          setRoomData(roomResponse.data);
        } else {
          addAlert('No room associated with this session.', 'danger');
          navigate('/student');
        }
      } catch (error) {
        console.error('Error fetching session data:', error);
        addAlert('Failed to load session data. Please rejoin the room.', 'danger');
        navigate('/student');
      }
    };

    if (sessionId) {
      fetchSessionData();
    }
  }, [sessionId, navigate]);

  // Handle PDF Upload
  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setPdfError('Please upload a PDF file only');
      setTimeout(() => setPdfError(''), 3000);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPdfError('File size should be less than 10MB');
      setTimeout(() => setPdfError(''), 3000);
      return;
    }

    if (!roomId) {
      setPdfError('No valid room associated with this session');
      setTimeout(() => setPdfError(''), 3000);
      return;
    }

    // Verify active session
    try {
      const token = localStorage.getItem('student_token') || localStorage.getItem('token');
      const sessionCheck = await axios.get(`${API_BASE_URL}/api/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!sessionCheck.data.is_active || sessionCheck.data.room_id !== roomId) {
        setPdfError('No active session for this room');
        setTimeout(() => setPdfError(''), 3000);
        return;
      }
    } catch (error) {
      setPdfError('Failed to verify active session');
      setTimeout(() => setPdfError(''), 3000);
      return;
    }

    setUploadingPdf(true);
    setPdfError('');

    try {
      const token = localStorage.getItem('student_token') || localStorage.getItem('token');
      const formData = new FormData();
      formData.append('pdf', file);

      await axios.post(
        `${API_BASE_URL}/api/rooms/${roomId}/student-upload-pdf`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setHasPdf(true);
      setPdfSuccess('PDF uploaded successfully!');
      setPdfRefreshKey(prev => prev + 1);
      addAlert('Study material uploaded successfully!', 'success');
      setTimeout(() => setPdfSuccess(''), 3000);
    } catch (error) {
      console.error('Upload PDF error:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to upload PDF';
      setPdfError(errorMessage);
      setTimeout(() => setPdfError(''), 3000);
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Socket.IO and other logic remains unchanged
  useEffect(() => {
    if (sessionId && roomId && sessionActive) {
      socketRef.current = io(API_BASE_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });
      
      socketRef.current.on('connect', () => {
        socketRef.current.emit('join_room', { room_id: roomId, session_id: sessionId });
      });
    }
    
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [sessionId, roomId, sessionActive]);

  useEffect(() => {
    let interval;
    if (sessionActive) {
      interval = setInterval(() => setSessionTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [sessionActive]);

  useEffect(() => {
    if (sessionActive) {
      const scheduleCheck = () => {
        const delay = (10 + Math.random() * 5) * 60 * 1000;
        presenceCheckInterval.current = setTimeout(() => {
          setShowPresenceCheck(true);
          scheduleCheck();
        }, delay);
      };
      scheduleCheck();
    }
    return () => {
      if (presenceCheckInterval.current) clearTimeout(presenceCheckInterval.current);
    };
  }, [sessionActive]);

  useEffect(() => {
    if (metrics && sessionActive && socketRef.current?.connected && roomId) {
      const metricsData = {
        session_id: sessionId,
        room_id: roomId,
        timestamp: Date.now() / 1000,
        facePresent: metrics.facePresent,
        faceAreaRatio: metrics.faceAreaRatio,
        gazeOnScreen: metrics.gazeOnScreen,
        attentionScore: metrics.attentionScore,
        engagementScore: metrics.engagementScore,
        blinkRate: metrics.blinkRate,
        headPose: metrics.headPose,
        gazeDirection: metrics.gazeDirection,
        fatigueLevel: metrics.fatigueLevel
      };
      
      socketRef.current.emit('metric', metricsData);

      setAggregateMetrics(prev => {
        const count = sessionTime > 0 ? sessionTime : 1;
        const attentionScore = Number.isFinite(metrics.attentionScore) ? metrics.attentionScore : 0;
        const fatigueLevel = Number.isFinite(metrics.fatigueLevel) ? metrics.fatigueLevel : 0;
        
        const newAvgAttention = sessionTime > 0 
          ? (prev.avgAttention * (count - 1) + attentionScore) / count 
          : attentionScore;
        const newAvgFatigue = sessionTime > 0 
          ? (prev.avgFatigue * (count - 1) + fatigueLevel) / count 
          : fatigueLevel;
        
        return {
          avgAttention: newAvgAttention,
          avgFatigue: newAvgFatigue,
          faceDetectionRate: metrics.facePresent ? prev.faceDetectionRate + 1 : prev.faceDetectionRate,
          totalDistractions: metrics.distractionCount,
          peakAttention: Math.max(prev.peakAttention, attentionScore),
          lowestAttention: Math.min(prev.lowestAttention, attentionScore)
        };
      });

      if (sessionTime % 10 === 0) {
        setPerformanceHistory(prev => [...prev, {
          time: sessionTime,
          attention: metrics.attentionScore,
          fatigue: metrics.fatigueLevel
        }].slice(-30));
      }

      if (metrics.attentionScore < 40 && metrics.facePresent) {
        addAlert('Low attention detected - refocus recommended', 'warning');
      }
      if (metrics.fatigueLevel > 70) {
        addAlert('High fatigue - consider taking a break', 'danger');
      }
      if (!metrics.facePresent && sessionTime > 10) {
        addAlert('Face not detected - ensure proper positioning', 'info');
      }
      if (metrics.lookingAwayDuration > 15) {
        addAlert('Extended distraction detected', 'warning');
      }
      if (metrics.postureLean > 30) {
        addAlert('Poor posture detected - sit upright', 'info');
      }
    }
  }, [metrics, sessionActive, roomId, sessionTime]);

  const addAlert = (message, type) => {
    const newAlert = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setAlerts(prev => {
      const exists = prev.some(a => a.message === message && Date.now() - a.id < 30000);
      if (exists) return prev;
      return [newAlert, ...prev.slice(0, 9)];
    });
  };

  const handlePresenceVerified = (data) => {
    setShowPresenceCheck(false);
    setPresenceCheckData(data);
    addAlert('Presence verified - Great job!', 'success');
    socketRef.current?.emit('presence_verified', { session_id: sessionId, ...data });
  };

  const handlePresenceFailed = (reason) => {
    setShowPresenceCheck(false);
    addAlert('Presence verification failed - Session paused', 'danger');
    setSessionActive(false);
    socketRef.current?.emit('presence_failed', { session_id: sessionId, reason });
  };

  const startSession = async () => {
    if (!isInitialized || !cameraReady) {
      addAlert('Please wait for camera and AI to initialize', 'warning');
      return;
    }
    
    if (!roomId) {
      addAlert('Room information not loaded', 'danger');
      return;
    }
    
    sessionStartTimeRef.current = Date.now();
    setSessionActive(true);
    addAlert('Study session started - Good luck!', 'success');
  };

  const endSession = async () => {
    setSessionActive(false);
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    try {
      const token = localStorage.getItem('student_token') || localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/api/sessions/${sessionId}/end`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error ending session:', error);
    }
    
    navigate('/student');
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hrs > 0 
      ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAttentionColor = (score) => {
    if (score >= 75) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.8rem', color: '#1a1a2e' }}>
            Study Session
          </h2>
          <p style={{ margin: 0, color: '#6b7280' }}>
            {sessionData?.room?.title || 'Loading...'} | Session Time: {formatTime(sessionTime)}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setShowMetricsPanel(!showMetricsPanel)}
            style={{
              padding: '10px 20px',
              background: '#e5e7eb',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            {showMetricsPanel ? 'Hide' : 'Show'} Metrics
          </button>
          
          {!sessionActive ? (
            <button
              onClick={startSession}
              disabled={!isInitialized || !cameraReady || !roomId}
              style={{
                padding: '12px 32px',
                background: !isInitialized || !cameraReady || !roomId 
                  ? '#9ca3af' 
                  : 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: !isInitialized || !cameraReady || !roomId ? 'not-allowed' : 'pointer',
                fontSize: '1.1rem',
                fontWeight: '700',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                transition: 'all 0.3s ease'
              }}
            >
              {!isInitialized ? 'Loading AI...' : !cameraReady ? 'Initializing Camera...' : !roomId ? 'Loading Room...' : 'Start Session'}
            </button>
          ) : (
            <button
              onClick={endSession}
              style={{
                padding: '12px 32px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: '700',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}
            >
              End Session
            </button>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: showMetricsPanel ? '400px 1fr 1fr' : '1fr 1fr',
        gap: '20px',
        height: 'calc(100vh - 160px)'
      }}>
        {/* Metrics Panel */}
        {showMetricsPanel && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            overflowY: 'auto'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.3rem' }}>
              Live Metrics
            </h3>

            <div style={{
              padding: '16px',
              background: metrics.facePresent 
                ? 'linear-gradient(135deg, #22c55e20, #16a34a20)'
                : 'linear-gradient(135deg, #ef444420, #dc262620)',
              borderRadius: '12px',
              marginBottom: '20px',
              border: `2px solid ${metrics.facePresent ? '#22c55e' : '#ef4444'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: metrics.facePresent ? '#22c55e' : '#ef4444',
                  animation: 'pulse 2s infinite'
                }}></div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                    {metrics.facePresent ? 'Monitoring Active' : 'No Face Detected'}
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                    {metrics.facePresent ? metrics.focusQuality + ' Focus' : 'Position yourself in frame'}
                  </div>
                </div>
              </div>
            </div>

            {metrics.facePresent && (
              <>
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600' }}>Attention Score</span>
                      <span style={{ 
                        fontWeight: '700', 
                        fontSize: '1.2rem',
                        color: getAttentionColor(metrics.attentionScore)
                      }}>
                        {metrics.attentionScore}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '12px',
                      background: '#e5e7eb',
                      borderRadius: '6px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${metrics.attentionScore}%`,
                        height: '100%',
                        background: getAttentionColor(metrics.attentionScore),
                        transition: 'width 0.5s ease'
                      }}></div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600' }}>Fatigue Level</span>
                      <span style={{ 
                        fontWeight: '700', 
                        fontSize: '1.2rem',
                        color: getAttentionColor(100 - metrics.fatigueLevel)
                      }}>
                        {metrics.fatigueLevel}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '12px',
                      background: '#e5e7eb',
                      borderRadius: '6px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${metrics.fatigueLevel}%`,
                        height: '100%',
                        background: getAttentionColor(100 - metrics.fatigueLevel),
                        transition: 'width 0.5s ease'
                      }}></div>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '20px'
                }}>
                  <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '4px' }}>Looking at Screen</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: '700' }}>{metrics.gazeOnScreen ? 'Yes' : 'No'}</div>
                  </div>

                  <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '4px' }}>Blink Rate</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: '700' }}>{metrics.blinkRate}/min</div>
                  </div>

                  <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '4px' }}>Distractions</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: '700' }}>{metrics.distractionCount}</div>
                  </div>

                  <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '4px' }}>Posture Lean</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: '700' }}>{metrics.postureLean}°</div>
                  </div>
                </div>

                <div style={{
                  padding: '12px',
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '8px' }}>Head Position</div>
                  <div style={{ fontSize: '0.9rem' }}>
                    Yaw: {metrics.headPose.yaw}° | Pitch: {metrics.headPose.pitch}° | Roll: {metrics.headPose.roll}°
                  </div>
                </div>

                <div style={{
                  padding: '16px',
                  background: 'linear-gradient(135deg, #3b82f620, #8b5cf620)',
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Session Summary</h4>
                  <div style={{ fontSize: '0.9rem' }}>
                    <div style={{ marginBottom: '6px' }}>
                      Avg Attention: <strong>{aggregateMetrics.avgAttention.toFixed(0)}%</strong>
                    </div>
                    <div style={{ marginBottom: '6px' }}>
                      Peak: <strong>{aggregateMetrics.peakAttention}%</strong>
                    </div>
                    <div>
                      Total Distractions: <strong>{metrics.distractionCount}</strong>
                    </div>
                  </div>
                </div>
              </>
            )}

            {alerts.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '12px' }}>Recent Alerts</h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {alerts.slice(0, 5).map(alert => (
                    <div
                      key={alert.id}
                      style={{
                        padding: '10px',
                        marginBottom: '8px',
                        background: alert.type === 'danger' ? '#fef2f2' :
                                   alert.type === 'warning' ? '#fffbeb' :
                                   alert.type === 'success' ? '#f0fdf4' : '#eff6ff',
                        border: `1px solid ${
                          alert.type === 'danger' ? '#fecaca' :
                          alert.type === 'warning' ? '#fed7aa' :
                          alert.type === 'success' ? '#bbf7d0' : '#bfdbfe'
                        }`,
                        borderRadius: '8px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>{alert.message}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{alert.timestamp}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Camera Feed */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Camera Feed</h3>
          
          <div style={{
            position: 'relative',
            flex: 1,
            background: '#000',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)'
              }}
            />
            
            {sessionActive && (
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                padding: '8px 16px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  animation: 'pulse 1.5s infinite'
                }}></div>
                RECORDING
              </div>
            )}

            {sessionActive && metrics.facePresent && (
              <div style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '12px 24px',
                background: metrics.focusQuality === 'Excellent' ? '#22c55e' :
                           metrics.focusQuality === 'Good' ? '#3b82f6' :
                           metrics.focusQuality === 'Fair' ? '#f59e0b' : '#ef4444',
                color: 'white',
                borderRadius: '24px',
                fontSize: '1rem',
                fontWeight: '700',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                {metrics.focusQuality} Focus
              </div>
            )}
          </div>
        </div>

        {/* PDF Viewer with Upload Option */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {roomId ? (
            hasPdf ? (
              <StudentPDFViewer 
                key={pdfRefreshKey}
                roomId={roomId} 
                sessionId={sessionId} 
              />
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '24px' }}>📄</div>
                <h3 style={{ margin: '0 0 12px 0', color: '#1a1a2e' }}>
                  No Study Material Available
                </h3>
                <p style={{ color: '#6b7280', marginBottom: '24px', textAlign: 'center', maxWidth: '400px' }}>
                  Your teacher hasn't uploaded any study material yet. You can upload your own PDF to study with!
                </p>

                {pdfError && (
                  <div style={{
                    padding: '12px 20px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '0.9rem'
                  }}>
                    ⚠️ {pdfError}
                  </div>
                )}

                {pdfSuccess && (
                  <div style={{
                    padding: '12px 20px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#065f46',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '0.9rem'
                  }}>
                    ✓ {pdfSuccess}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  style={{ display: 'none' }}
                  disabled={uploadingPdf}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPdf || !roomId}
                  style={{
                    padding: '16px 32px',
                    background: uploadingPdf || !roomId 
                      ? '#9ca3af' 
                      : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: uploadingPdf || !roomId ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadingPdf && roomId) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
                  }}
                >
                  {uploadingPdf ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }}></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '1.2rem' }}>📤</span>
                      Upload Your PDF
                    </>
                  )}
                </button>

                <div style={{
                  marginTop: '20px',
                  padding: '12px 20px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  color: '#0369a1',
                  textAlign: 'center'
                }}>
                  <strong>📋 Requirements:</strong> PDF only • Max 10MB
                </div>

                <div style={{
                  marginTop: '16px',
                  fontSize: '0.8rem',
                  color: '#9ca3af',
                  textAlign: 'center'
                }}>
                  💡 Tip: Upload textbooks, notes, or practice problems to study with AI monitoring
                </div>
              </div>
            )
          ) : (
            <div style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
                <div style={{ fontSize: '1.2rem' }}>Loading study material...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <PresenceVerificationModal
        isOpen={showPresenceCheck}
        onVerified={handlePresenceVerified}
        onFailed={handlePresenceFailed}
        sessionSubject={sessionData?.room?.subject}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default StudySession;