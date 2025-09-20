import { useRef, useState, useCallback, useEffect } from 'react';
import { FaceDetector, FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export const useMediaPipeFaceGaze = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const animationFrameId = useRef(null);
  const lastProcessingTime = useRef(0);

  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [gazeData, setGazeData] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize MediaPipe models
  const initializeModels = useCallback(async () => {
    try {
      console.log('Initializing MediaPipe models...');
      
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      // Initialize Face Detector
      const faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5
      });

      // Initialize Face Landmarker  
      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        numFaces: 1
      });

      faceDetectorRef.current = faceDetector;
      faceLandmarkerRef.current = faceLandmarker;
      setIsModelLoaded(true);
      console.log('MediaPipe models initialized successfully');
    } catch (err) {
      console.error('Model initialization error:', err);
      setError(`Model initialization failed: ${err.message}`);
    }
  }, []);

  // Initialize camera access
  const initializeCamera = useCallback(async () => {
    try {
      console.log('Requesting camera access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 1280, 
          height: 720, 
          frameRate: 30,
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log('Camera ready');
          setIsCameraReady(true);
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError(`Camera access failed: ${err.message}`);
    }
  }, []);

  // Calculate head pose from landmarks
  const calculateHeadPose = useCallback((landmarks, width, height) => {
    if (!landmarks || landmarks.length < 468) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    // Key landmark indices for head pose calculation
    const noseTip = landmarks[1];        // Nose tip
    const leftEyeCorner = landmarks[33]; // Left eye outer corner  
    const rightEyeCorner = landmarks[263]; // Right eye outer corner
    const chin = landmarks[18];          // Chin point

    // Convert normalized coordinates to pixel coordinates
    const nose = { x: noseTip.x * width, y: noseTip.y * height };
    const leftEye = { x: leftEyeCorner.x * width, y: leftEyeCorner.y * height };
    const rightEye = { x: rightEyeCorner.x * width, y: rightEyeCorner.y * height };
    const chinPoint = { x: chin.x * width, y: chin.y * height };
    
    // Calculate roll angle from eye alignment
    const eyeVector = { x: rightEye.x - leftEye.x, y: rightEye.y - leftEye.y };
    const roll = Math.atan2(eyeVector.y, eyeVector.x) * (180 / Math.PI);
    
    // Calculate pitch from nose-chin relationship
    const normalizedPitch = (nose.y - height/2) / (height/2);
    const pitch = Math.asin(Math.max(-1, Math.min(1, normalizedPitch))) * (180 / Math.PI);
    
    // Calculate yaw from nose position relative to eye midpoint
    const eyeMidpoint = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
    const normalizedYaw = (nose.x - eyeMidpoint.x) / (width / 4);
    const yaw = Math.asin(Math.max(-1, Math.min(1, normalizedYaw))) * (180 / Math.PI);
    
    return { pitch, yaw, roll };
  }, []);

  // Estimate gaze direction from landmarks
  const estimateGazeDirection = useCallback((landmarks, headPose) => {
    if (!landmarks || landmarks.length < 468) {
      return { x: 0, y: 0 };
    }

    // Use eye landmarks for gaze estimation (approximate indices)
    const leftEyeCenter = landmarks[468] || landmarks[33];
    const rightEyeCenter = landmarks[473] || landmarks[263];
    
    // Calculate average eye position
    const avgEyeX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
    const avgEyeY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
    
    // Simple gaze estimation based on eye position relative to center
    const gazeX = (avgEyeX - 0.5) * 2; // Normalize to [-1, 1]
    const gazeY = (avgEyeY - 0.45) * 2; // Slightly adjust center for eyes
    
    // Compensate for head pose
    const compensatedX = gazeX - (headPose.yaw * 0.01);
    const compensatedY = gazeY - (headPose.pitch * 0.01);
    
    return { x: compensatedX, y: compensatedY };
  }, []);

  // Calculate attention metrics
  const calculateAttentionMetrics = useCallback((gazeDirection, headPose) => {
    // Attention score based on gaze stability and head pose
    const gazeDeviation = Math.sqrt(gazeDirection.x**2 + gazeDirection.y**2);
    const headMovement = Math.sqrt(headPose.pitch**2 + headPose.yaw**2) / 30; // Normalize
    
    const attentionScore = Math.max(0, 100 - (gazeDeviation * 100) - (headMovement * 50));
    
    // Fatigue detection based on head droop
    const fatigueLevel = Math.max(0, Math.min(100, headPose.pitch * 2 + 50));
    
    return {
      attention_score: attentionScore,
      fatigue_level: fatigueLevel,
      gaze_stability: Math.max(0, 100 - (gazeDeviation * 200))
    };
  }, []);

  // Draw visualization overlay
  const drawVisualization = useCallback((ctx, data) => {
    if (!ctx || !data) return;

    const { faceDetections, faceLandmarks, headPose, gazeDirection, metrics } = data;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw face detection bounding box
    if (faceDetections && faceDetections.length > 0) {
      const detection = faceDetections[0];
      const bbox = detection.boundingBox;
      
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        bbox.originX * ctx.canvas.width,
        bbox.originY * ctx.canvas.height,
        bbox.width * ctx.canvas.width,
        bbox.height * ctx.canvas.height
      );
    }
    
    // Draw key facial landmarks
    if (faceLandmarks && faceLandmarks.length > 0) {
      ctx.fillStyle = '#FF0000';
      
      // Draw only key landmarks to avoid clutter
      const keyLandmarks = [1, 33, 263, 61, 291, 18]; // nose, eyes, mouth, chin
      keyLandmarks.forEach(index => {
        if (faceLandmarks[index]) {
          const landmark = faceLandmarks[index];
          ctx.beginPath();
          ctx.arc(
            landmark.x * ctx.canvas.width,
            landmark.y * ctx.canvas.height,
            4, 0, 2 * Math.PI
          );
          ctx.fill();
        }
      });
    }
    
    // Draw gaze direction vector
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    
    ctx.strokeStyle = '#FF00FF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + gazeDirection.x * 100,
      centerY + gazeDirection.y * 100
    );
    ctx.stroke();
    
    // Display metrics text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Inter, Arial, sans-serif';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    
    const textY = 30;
    const texts = [
      `Attention: ${metrics.attention_score.toFixed(0)}%`,
      `Head Pose: P${headPose.pitch.toFixed(1)}° Y${headPose.yaw.toFixed(1)}° R${headPose.roll.toFixed(1)}°`,
      `Gaze: X${gazeDirection.x.toFixed(2)} Y${gazeDirection.y.toFixed(2)}`,
      `Fatigue: ${metrics.fatigue_level.toFixed(0)}%`
    ];
    
    texts.forEach((text, index) => {
      const y = textY + (index * 25);
      ctx.strokeText(text, 10, y);
      ctx.fillText(text, 10, y);
    });
  }, []);

  // Main processing frame function
  const processFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || 
        !faceDetectorRef.current || !faceLandmarkerRef.current ||
        !isCameraReady || !isModelLoaded || isProcessing) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    setIsProcessing(true);
    
    try {
      const startTime = performance.now();
      const timestamp = startTime;
      
      // Perform face detection
      const faceDetections = await faceDetectorRef.current.detectForVideo(video, timestamp);
      
      // Perform face landmark detection
      const faceLandmarkResults = await faceLandmarkerRef.current.detectForVideo(video, timestamp);
      
      let processedData = null;
      
      if (faceDetections.detections.length > 0 && faceLandmarkResults.faceLandmarks.length > 0) {
        const landmarks = faceLandmarkResults.faceLandmarks[0];
        
        // Calculate head pose angles
        const headPose = calculateHeadPose(landmarks, canvas.width, canvas.height);
        
        // Estimate gaze direction
        const gazeDirection = estimateGazeDirection(landmarks, headPose);
        
        // Calculate attention metrics
        const metrics = calculateAttentionMetrics(gazeDirection, headPose);
        
        // Create comprehensive data object
        processedData = {
          timestamp,
          face_present: true,
          faceDetections: faceDetections.detections,
          faceLandmarks: landmarks,
          headPose,
          gazeDirection,
          metrics,
          processing_time: performance.now() - startTime
        };
        
        setGazeData(processedData);
        
        // Draw visualization overlay
        drawVisualization(ctx, processedData);
      } else {
        // No face detected
        processedData = {
          timestamp,
          face_present: false,
          faceDetections: [],
          faceLandmarks: [],
          headPose: { pitch: 0, yaw: 0, roll: 0 },
          gazeDirection: { x: 0, y: 0 },
          metrics: { attention_score: 0, fatigue_level: 0, gaze_stability: 0 },
          processing_time: performance.now() - startTime
        };
        
        setGazeData(processedData);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Show "No face detected" message
        ctx.fillStyle = '#FF0000';
        ctx.font = '20px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No Face Detected', canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'left';
      }
      
      lastProcessingTime.current = performance.now() - startTime;
      
    } catch (err) {
      console.error('Frame processing error:', err);
      setError(`Processing error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isModelLoaded, isCameraReady, isProcessing, calculateHeadPose, estimateGazeDirection, calculateAttentionMetrics, drawVisualization]);

  // Start detection
  const startDetection = useCallback(() => {
    if (!isModelLoaded || !isCameraReady) {
      console.warn('Models or camera not ready');
      return;
    }

    const processFrameLoop = () => {
      processFrame();
      animationFrameId.current = requestAnimationFrame(processFrameLoop);
    };

    processFrameLoop();
  }, [isModelLoaded, isCameraReady, processFrame]);

  // Stop detection
  const stopDetection = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeModels();
    initializeCamera();

    return () => {
      stopDetection();
      
      // Clean up video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [initializeModels, initializeCamera, stopDetection]);

  return {
    videoRef,
    canvasRef,
    isModelLoaded,
    isCameraReady,
    gazeData,
    error,
    startDetection,
    stopDetection,
    processingTime: lastProcessingTime.current
  };
};