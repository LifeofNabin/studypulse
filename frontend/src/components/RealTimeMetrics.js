import React from 'react';

const RealTimeMetrics = ({ metrics }) => {
  const getColor = (score) => {
    if (score >= 70) return '#22c55e'; // Green
    if (score >= 50) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        padding: '20px',
        borderRadius: '12px',
        minWidth: '300px',
        maxWidth: '350px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 1000,
        fontSize: '14px',
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>
        Live Metrics
      </h3>

      {/* Face Detection Status */}
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: metrics.facePresent ? '#22c55e' : '#ef4444',
            marginRight: '8px',
          }}
        ></div>
        <span>{metrics.facePresent ? 'Face Detected' : 'No Face Detected'}</span>
      </div>

      {metrics.facePresent && (
        <>
          {/* Attention Score */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <span>Attention Score:</span>
              <strong style={{ color: getColor(metrics.attentionScore) }}>
                {metrics.attentionScore}%
              </strong>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                background: '#333',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${metrics.attentionScore}%`,
                  height: '100%',
                  background: getColor(metrics.attentionScore),
                  transition: 'width 0.3s ease',
                }}
              ></div>
            </div>
          </div>

          {/* Focus Quality */}
          <div style={{ marginBottom: '12px' }}>
            <strong>Focus Quality:</strong> {metrics.focusQuality}
          </div>

          {/* Gaze Status */}
          <div style={{ marginBottom: '12px' }}>
            <strong>Looking at Screen:</strong>{' '}
            {metrics.gazeOnScreen ? 'Yes' : 'No'}
          </div>

          {/* Fatigue Level */}
          <div style={{ marginBottom: '12px' }}>
            <strong>Fatigue Level:</strong> {metrics.fatigueLevel}%
            {metrics.fatigueLevel > 60 && (
              <span style={{ color: '#f59e0b', marginLeft: '8px' }}>
                ⚠️ Take a break
              </span>
            )}
          </div>

          {/* Blink Rate */}
          <div style={{ marginBottom: '12px' }}>
            <strong>Blink Rate:</strong> {metrics.blinkRate} /min
            {metrics.blinkRate < 10 && (
              <span
                style={{
                  color: '#f59e0b',
                  marginLeft: '8px',
                  fontSize: '12px',
                }}
              >
                (Low - rest eyes)
              </span>
            )}
          </div>

          {/* Head Pose */}
          <div style={{ marginBottom: '12px' }}>
            <strong>Head Position:</strong>
            <div
              style={{
                fontSize: '12px',
                marginTop: '4px',
                opacity: 0.8,
              }}
            >
              Yaw: {metrics.headPose.yaw}° | Pitch: {metrics.headPose.pitch}° | Roll:{' '}
              {metrics.headPose.roll}°
            </div>
          </div>

          {/* Distractions */}
          <div style={{ marginBottom: '12px' }}>
            <strong>Distractions:</strong> {metrics.distractionCount}
          </div>

          {/* Eye Openness */}
          <div style={{ marginBottom: '12px' }}>
            <strong>Eye Openness:</strong>
            <div
              style={{
                fontSize: '12px',
                marginTop: '4px',
                opacity: 0.8,
              }}
            >
              L: {(metrics.eyeOpenness.left * 100).toFixed(0)}% | R:{' '}
              {(metrics.eyeOpenness.right * 100).toFixed(0)}%
            </div>
          </div>

          {/* Looking Away Duration */}
          {metrics.lookingAwayDuration > 3 && (
            <div
              style={{
                padding: '8px',
                background: '#f59e0b',
                borderRadius: '6px',
                marginTop: '12px',
                textAlign: 'center',
              }}
            >
              ⚠️ Looking away for {metrics.lookingAwayDuration}s
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RealTimeMetrics;
