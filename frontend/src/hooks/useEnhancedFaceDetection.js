import { useRef, useState, useCallback, useEffect } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const useEnhancedFaceDetection = (videoRef, isActive) => {
  const faceLandmarkerRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [metrics, setMetrics] = useState({
    facePresent: false,
    attentionScore: 0,
    fatigueLevel: 0,
    blinkRate: 0,
    gazeOnScreen: false,
    focusQuality: 'Poor',
    headPose: { yaw: 0, pitch: 0, roll: 0 },
    gazeDirection: { x: 0, y: 0 },
    distractionCount: 0,
    lookingAwayDuration: 0,
    postureLean: 0,
    eyeOpenness: { left: 1, right: 1 },
    faceAreaRatio: 0,
    engagementScore: 0,
    multipleFacesDetected: false,
    phoneDetected: false,
    isSamePerson: true,
    confidenceScore: 0
  });

  // Tracking state
  const trackingData = useRef({
    // Face Recognition
    initialFaceEmbedding: null,
    faceVerificationHistory: [],
    
    // Blink Detection
    blinkHistory: [],
    lastBlinkTime: 0,
    consecutiveClosedFrames: 0,
    blinkCount: 0,
    longBlinkCount: 0,
    
    // Attention Tracking
    gazeHistory: [],
    lookAwayStartTime: null,
    totalLookAwayTime: 0,
    distractionEvents: [],
    
    // Head Pose Tracking
    headPoseHistory: [],
    stableHeadPoseCount: 0,
    
    // Engagement
    microMovements: [],
    lastSignificantMovement: Date.now(),
    readingPattern: [],
    
    // Session Baseline
    baselineMetrics: {
      avgHeadPose: { yaw: 0, pitch: 0, roll: 0 },
      avgGaze: { x: 0, y: 0 },
      avgBlinkRate: 15,
      calibrated: false
    },
    
    // Temporal smoothing
    metricBuffer: [],
    frameCount: 0
  });

  // Initialize MediaPipe
  useEffect(() => {
    const initializeMediaPipe = async () => {
      try {
        console.log('🔄 Initializing Enhanced Face Detection...');
        
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          numFaces: 2 // Detect up to 2 faces for cheating detection
        });

        faceLandmarkerRef.current = faceLandmarker;
        setIsInitialized(true);
        console.log('✅ Enhanced Face Detection Initialized');
      } catch (error) {
        console.error('❌ Initialization Error:', error);
      }
    };

    initializeMediaPipe();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Extract face embedding for recognition
  const extractFaceEmbedding = useCallback((landmarks) => {
    if (!landmarks || landmarks.length < 468) return null;
    
    // Use key facial points to create a unique embedding
    const keyPoints = [
      1, 33, 263, 61, 291, 199, // Nose, eyes, mouth
      10, 152, 234, 454, // Face contour
      4, 5, 195, 197 // Nose bridge
    ];
    
    const embedding = keyPoints.map(idx => {
      const point = landmarks[idx];
      return [point.x, point.y, point.z || 0];
    }).flat();
    
    return embedding;
  }, []);

  // Compare face embeddings for verification
  const verifyFaceIdentity = useCallback((currentEmbedding, referenceEmbedding) => {
    if (!currentEmbedding || !referenceEmbedding) return { isSame: false, confidence: 0 };
    
    // Calculate Euclidean distance
    let sumSquaredDiff = 0;
    for (let i = 0; i < currentEmbedding.length; i++) {
      const diff = currentEmbedding[i] - referenceEmbedding[i];
      sumSquaredDiff += diff * diff;
    }
    
    const distance = Math.sqrt(sumSquaredDiff);
    const normalizedDistance = Math.min(distance / 2, 1); // Normalize to 0-1
    const confidence = Math.max(0, (1 - normalizedDistance) * 100);
    
    // Threshold for same person (80% confidence)
    const isSame = confidence > 80;
    
    return { isSame, confidence };
  }, []);

  // Enhanced blink detection
  const detectBlinks = useCallback((blendshapes) => {
    if (!blendshapes) return { blinkDetected: false, eyesClosed: false };
    
    // Get eye closure values from blendshapes
    const leftEyeBlink = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score || 0;
    const rightEyeBlink = blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score || 0;
    
    const avgBlink = (leftEyeBlink + rightEyeBlink) / 2;
    const eyesClosed = avgBlink > 0.6; // Threshold for closed eyes
    const blinkThreshold = 0.5;
    
    // Track consecutive closed frames
    if (eyesClosed) {
      trackingData.current.consecutiveClosedFrames++;
    } else {
      trackingData.current.consecutiveClosedFrames = 0;
    }
    
    // Detect blink (quick close-open)
    const now = Date.now();
    const timeSinceLastBlink = now - trackingData.current.lastBlinkTime;
    let blinkDetected = false;
    
    if (avgBlink > blinkThreshold && timeSinceLastBlink > 150) {
      blinkDetected = true;
      trackingData.current.lastBlinkTime = now;
      trackingData.current.blinkCount++;
      
      // Track blink history
      trackingData.current.blinkHistory.push({
        timestamp: now,
        duration: trackingData.current.consecutiveClosedFrames * 33 // Approx frame time
      });
      
      // Keep last 60 seconds
      trackingData.current.blinkHistory = trackingData.current.blinkHistory.filter(
        b => now - b.timestamp < 60000
      );
      
      // Detect long blinks (drowsiness indicator)
      if (trackingData.current.consecutiveClosedFrames > 5) {
        trackingData.current.longBlinkCount++;
      }
    }
    
    // Calculate blink rate (per minute)
    const recentBlinks = trackingData.current.blinkHistory.length;
    const blinkRate = recentBlinks; // Already filtered to 60 seconds
    
    return {
      blinkDetected,
      eyesClosed,
      blinkRate,
      longBlinkRatio: trackingData.current.longBlinkCount / Math.max(1, trackingData.current.blinkCount),
      leftEyeOpenness: 1 - leftEyeBlink,
      rightEyeOpenness: 1 - rightEyeBlink
    };
  }, []);

  // Calculate head pose from landmarks
  const calculateHeadPose = useCallback((landmarks, width, height) => {
    if (!landmarks || landmarks.length < 468) {
      return { yaw: 0, pitch: 0, roll: 0 };
    }

    const noseTip = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const chin = landmarks[152];
    const forehead = landmarks[10];

    // Calculate roll (head tilt)
    const eyeDx = rightEye.x - leftEye.x;
    const eyeDy = rightEye.y - leftEye.y;
    const roll = Math.atan2(eyeDy, eyeDx) * (180 / Math.PI);

    // Calculate pitch (up/down)
    const faceHeight = Math.abs(forehead.y - chin.y);
    const noseOffsetY = (noseTip.y - (forehead.y + chin.y) / 2) / faceHeight;
    const pitch = Math.asin(Math.max(-1, Math.min(1, noseOffsetY * 2))) * (180 / Math.PI);

    // Calculate yaw (left/right)
    const eyeCenter = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
    const noseOffsetX = (noseTip.x - eyeCenter.x) / (rightEye.x - leftEye.x);
    const yaw = Math.asin(Math.max(-1, Math.min(1, noseOffsetX))) * (180 / Math.PI);

    return {
      yaw: Math.round(yaw),
      pitch: Math.round(pitch),
      roll: Math.round(roll)
    };
  }, []);

  // Estimate gaze direction
  const estimateGaze = useCallback((landmarks, headPose) => {
    if (!landmarks || landmarks.length < 468) {
      return { x: 0, y: 0, onScreen: false };
    }

    // Use iris landmarks if available (468-477)
    const leftIris = landmarks[468] || landmarks[33];
    const rightIris = landmarks[473] || landmarks[263];
    
    const avgIrisX = (leftIris.x + rightIris.x) / 2;
    const avgIrisY = (leftIris.y + rightIris.y) / 2;

    // Normalize gaze coordinates
    let gazeX = (avgIrisX - 0.5) * 2;
    let gazeY = (avgIrisY - 0.48) * 2;

    // Compensate for head pose
    gazeX -= headPose.yaw * 0.015;
    gazeY -= headPose.pitch * 0.015;

    // Determine if looking at screen
    const gazeDeviation = Math.sqrt(gazeX * gazeX + gazeY * gazeY);
    const onScreen = gazeDeviation < 0.6 && Math.abs(headPose.yaw) < 35 && Math.abs(headPose.pitch) < 25;

    return { x: gazeX, y: gazeY, onScreen, deviation: gazeDeviation };
  }, []);

  // Detect phone usage
  const detectPhoneUsage = useCallback((headPose, gaze) => {
    // Phone usage indicators:
    // 1. Head tilted down significantly
    // 2. Gaze directed downward
    // 3. Head not moving much (stable downward look)
    
    const phoneIndicatorScore = (
      (Math.abs(headPose.pitch) > 25 && headPose.pitch > 0 ? 30 : 0) + // Looking down
      (gaze.y > 0.4 ? 30 : 0) + // Gaze downward
      (Math.abs(headPose.yaw) < 15 ? 20 : 0) + // Face forward (not turning away)
      (gaze.deviation < 0.3 ? 20 : 0) // Focused gaze (not wandering)
    );
    
    return phoneIndicatorScore > 60;
  }, []);

  // Calculate engagement score
  const calculateEngagement = useCallback((metrics, trackingData) => {
    let engagementScore = 0;
    
    // Gaze stability (40 points)
    if (metrics.gazeOnScreen) engagementScore += 40;
    else if (metrics.gaze.deviation < 0.8) engagementScore += 20;
    
    // Head pose stability (20 points)
    const headMovement = Math.abs(metrics.headPose.yaw) + Math.abs(metrics.headPose.pitch);
    if (headMovement < 20) engagementScore += 20;
    else if (headMovement < 35) engagementScore += 10;
    
    // Blink patterns (15 points)
    if (metrics.blinkRate >= 10 && metrics.blinkRate <= 25) engagementScore += 15;
    else if (metrics.blinkRate >= 5 && metrics.blinkRate <= 35) engagementScore += 8;
    
    // Micro-movements (10 points) - indicates active engagement
    const recentMovements = trackingData.microMovements.filter(
      m => Date.now() - m.timestamp < 5000
    ).length;
    if (recentMovements >= 2 && recentMovements <= 8) engagementScore += 10;
    
    // Time since last movement (10 points)
    const timeSinceMovement = Date.now() - trackingData.lastSignificantMovement;
    if (timeSinceMovement < 10000) engagementScore += 10;
    else if (timeSinceMovement < 30000) engagementScore += 5;
    
    // Fatigue penalty (5 points)
    if (metrics.fatigueLevel < 30) engagementScore += 5;
    
    return Math.min(100, engagementScore);
  }, []);

  // Multi-modal attention algorithm
  const calculateAttentionScore = useCallback((metrics, engagement) => {
    // Weighted multi-factor attention algorithm
    const weights = {
      gaze: 0.35,        // 35% - Most important
      headPose: 0.20,    // 20% - Head stability
      blink: 0.15,       // 15% - Blink patterns
      engagement: 0.15,  // 15% - Micro-behaviors
      fatigue: 0.10,     // 10% - Fatigue impact
      presence: 0.05     // 5% - Face verification
    };
    
    // Gaze score
    const gazeScore = metrics.gazeOnScreen ? 100 : Math.max(0, 100 - (metrics.gaze.deviation * 100));
    
    // Head pose score
    const headMovement = Math.abs(metrics.headPose.yaw) + Math.abs(metrics.headPose.pitch);
    const headScore = Math.max(0, 100 - (headMovement * 1.5));
    
    // Blink score (normal range: 10-20/min)
    const blinkDiff = Math.abs(metrics.blinkRate - 15);
    const blinkScore = Math.max(0, 100 - (blinkDiff * 3));
    
    // Fatigue impact (inverted)
    const fatigueScore = 100 - metrics.fatigueLevel;
    
    // Presence score
    const presenceScore = metrics.isSamePerson ? 100 : 0;
    
    // Calculate weighted sum
    const attentionScore = (
      gazeScore * weights.gaze +
      headScore * weights.headPose +
      blinkScore * weights.blink +
      engagement * weights.engagement +
      fatigueScore * weights.fatigue +
      presenceScore * weights.presence
    );
    
    return Math.round(Math.max(0, Math.min(100, attentionScore)));
  }, []);

  // Calculate fatigue level
  const calculateFatigue = useCallback((blinkData, headPose, sessionDuration) => {
    let fatigueScore = 0;
    
    // Long blinks indicate drowsiness
    if (blinkData.longBlinkRatio > 0.3) fatigueScore += 30;
    else if (blinkData.longBlinkRatio > 0.15) fatigueScore += 15;
    
    // Low blink rate (staring) indicates fatigue
    if (blinkData.blinkRate < 8) fatigueScore += 20;
    
    // High blink rate (excessive) also indicates fatigue
    if (blinkData.blinkRate > 30) fatigueScore += 15;
    
    // Head droop
    if (headPose.pitch > 15) fatigueScore += 20;
    else if (headPose.pitch > 8) fatigueScore += 10;
    
    // Session duration factor
    const durationMinutes = sessionDuration / 60;
    if (durationMinutes > 45) fatigueScore += 10;
    if (durationMinutes > 90) fatigueScore += 15;
    
    return Math.min(100, fatigueScore);
  }, []);

  // Temporal smoothing for stable metrics
  const smoothMetrics = useCallback((newMetrics) => {
    const buffer = trackingData.current.metricBuffer;
    buffer.push(newMetrics);
    
    // Keep last 10 frames (approx 330ms at 30fps)
    if (buffer.length > 10) buffer.shift();
    
    // Calculate moving average
    const smoothed = {};
    const keys = Object.keys(newMetrics);
    
    keys.forEach(key => {
      if (typeof newMetrics[key] === 'number') {
        const values = buffer.map(m => m[key]).filter(v => v !== undefined);
        smoothed[key] = values.reduce((a, b) => a + b, 0) / values.length;
      } else if (typeof newMetrics[key] === 'object' && newMetrics[key] !== null) {
        smoothed[key] = newMetrics[key]; // Keep objects as-is
      } else {
        smoothed[key] = newMetrics[key];
      }
    });
    
    return smoothed;
  }, []);

  // Main detection loop
  const detectFace = useCallback(async () => {
    if (!faceLandmarkerRef.current || !videoRef.current || !isActive) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState !== 4) {
      animationFrameRef.current = requestAnimationFrame(detectFace);
      return;
    }

    const startTime = performance.now();
    const timestamp = startTime;
    
    try {
      const results = await faceLandmarkerRef.current.detectForVideo(video, timestamp);
      
      trackingData.current.frameCount++;
      const frameCount = trackingData.current.frameCount;
      
      // Check for multiple faces (cheating detection)
      const multipleFaces = results.faceLandmarks && results.faceLandmarks.length > 1;
      
      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        // No face detected
        if (trackingData.current.lookAwayStartTime === null) {
          trackingData.current.lookAwayStartTime = Date.now();
        }
        
        const lookAwayDuration = Math.floor((Date.now() - trackingData.current.lookAwayStartTime) / 1000);
        
        setMetrics(prev => ({
          ...prev,
          facePresent: false,
          attentionScore: 0,
          lookingAwayDuration: lookAwayDuration,
          distractionCount: prev.distractionCount + (lookAwayDuration > 0 && lookAwayDuration % 5 === 0 ? 1 : 0)
        }));
        
      } else {
        // Face detected
        trackingData.current.lookAwayStartTime = null;
        
        const landmarks = results.faceLandmarks[0];
        const blendshapes = results.faceBlendshapes ? results.faceBlendshapes[0].categories : null;
        
        // Face recognition
        const currentEmbedding = extractFaceEmbedding(landmarks);
        let faceVerification = { isSame: true, confidence: 100 };
        
        if (!trackingData.current.initialFaceEmbedding) {
          // Store initial face for verification
          trackingData.current.initialFaceEmbedding = currentEmbedding;
        } else if (frameCount % 30 === 0) { // Verify every 30 frames
          faceVerification = verifyFaceIdentity(currentEmbedding, trackingData.current.initialFaceEmbedding);
          trackingData.current.faceVerificationHistory.push({
            timestamp: Date.now(),
            ...faceVerification
          });
        }
        
        // Head pose
        const headPose = calculateHeadPose(landmarks, video.videoWidth, video.videoHeight);
        
        // Gaze estimation
        const gaze = estimateGaze(landmarks, headPose);
        
        // Blink detection
        const blinkData = detectBlinks(blendshapes);
        
        // Phone detection
        const phoneDetected = detectPhoneUsage(headPose, gaze);
        
        // Calculate posture lean
        const postureLean = Math.abs(headPose.roll);
        
        // Track micro-movements
        if (frameCount > 10) {
          const prevHeadPose = trackingData.current.headPoseHistory[trackingData.current.headPoseHistory.length - 1];
          if (prevHeadPose) {
            const movement = Math.abs(headPose.yaw - prevHeadPose.yaw) + 
                           Math.abs(headPose.pitch - prevHeadPose.pitch);
            if (movement > 2) {
              trackingData.current.microMovements.push({ timestamp: Date.now(), magnitude: movement });
              trackingData.current.lastSignificantMovement = Date.now();
              
              // Keep last 30 seconds
              trackingData.current.microMovements = trackingData.current.microMovements.filter(
                m => Date.now() - m.timestamp < 30000
              );
            }
          }
        }
        
        // Store head pose history
        trackingData.current.headPoseHistory.push(headPose);
        if (trackingData.current.headPoseHistory.length > 100) {
          trackingData.current.headPoseHistory.shift();
        }
        
        // Calculate engagement
        const engagement = calculateEngagement({
          gazeOnScreen: gaze.onScreen,
          gaze,
          headPose,
          blinkRate: blinkData.blinkRate,
          fatigueLevel: 0 // Will be calculated next
        }, trackingData.current);
        
        // Calculate fatigue
        const sessionDuration = frameCount / 30; // Approximate seconds
        const fatigueLevel = calculateFatigue(blinkData, headPose, sessionDuration);
        
        // Calculate attention score
        const attentionScore = calculateAttentionScore({
          gazeOnScreen: gaze.onScreen,
          gaze,
          headPose,
          blinkRate: blinkData.blinkRate,
          fatigueLevel,
          isSamePerson: faceVerification.isSame
        }, engagement);
        
        // Determine focus quality
        let focusQuality = 'Poor';
        if (attentionScore >= 85) focusQuality = 'Excellent';
        else if (attentionScore >= 70) focusQuality = 'Good';
        else if (attentionScore >= 50) focusQuality = 'Fair';
        
        // Calculate face area ratio
        const faceWidth = Math.max(...landmarks.map(l => l.x)) - Math.min(...landmarks.map(l => l.x));
        const faceHeight = Math.max(...landmarks.map(l => l.y)) - Math.min(...landmarks.map(l => l.y));
        const faceAreaRatio = (faceWidth * faceHeight) * 100;
        
        // Create metrics object
        const newMetrics = {
          facePresent: true,
          attentionScore,
          fatigueLevel,
          blinkRate: Math.round(blinkData.blinkRate),
          gazeOnScreen: gaze.onScreen,
          focusQuality,
          headPose,
          gazeDirection: { x: Math.round(gaze.x * 100) / 100, y: Math.round(gaze.y * 100) / 100 },
          distractionCount: trackingData.current.distractionEvents.length,
          lookingAwayDuration: 0,
          postureLean: Math.round(postureLean),
          eyeOpenness: {
            left: Math.round(blinkData.leftEyeOpenness * 100) / 100,
            right: Math.round(blinkData.rightEyeOpenness * 100) / 100
          },
          faceAreaRatio: Math.round(faceAreaRatio * 10) / 10,
          engagementScore: Math.round(engagement),
          multipleFacesDetected: multipleFaces,
          phoneDetected,
          isSamePerson: faceVerification.isSame,
          confidenceScore: Math.round(faceVerification.confidence)
        };
        
        // Apply temporal smoothing
        const smoothedMetrics = smoothMetrics(newMetrics);
        
        setMetrics(smoothedMetrics);
      }
      
    } catch (error) {
      console.error('Detection error:', error);
    }

    animationFrameRef.current = requestAnimationFrame(detectFace);
  }, [
    isActive,
    extractFaceEmbedding,
    verifyFaceIdentity,
    detectBlinks,
    calculateHeadPose,
    estimateGaze,
    detectPhoneUsage,
    calculateEngagement,
    calculateAttentionScore,
    calculateFatigue,
    smoothMetrics
  ]);

  // Start/stop detection based on isActive
  useEffect(() => {
    if (isInitialized && isActive) {
      detectFace();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized, isActive, detectFace]);

  return {
    metrics,
    isInitialized,
    canvasRef
  };
};

export default useEnhancedFaceDetection;