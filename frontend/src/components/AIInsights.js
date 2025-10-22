import React, { useState, useEffect } from 'react';
import aiService from '../services/aiService';

const AIInsights = ({ progressData }) => {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [studyTips, setStudyTips] = useState(null);
  const [tipsLoading, setTipsLoading] = useState(false);

  useEffect(() => {
    if (progressData) {
      generatePrediction();
    }
  }, [progressData]);

  const generatePrediction = async () => {
    setLoading(true);
    try {
      const result = await aiService.predictReadiness({
        totalHours: progressData.totalStudyTime / 60,
        avgAttention: progressData.averageAttention,
        completedTopics: progressData.totalSessions,
        totalTopics: 20,
        daysLeft: 30
      });

      if (result.success) {
        setPrediction(result.prediction);
      }
    } catch (error) {
      console.error('Prediction error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSubjectTips = async (subject) => {
    setTipsLoading(true);
    try {
      const result = await aiService.getStudyTips(subject, 'intermediate');
      if (result.success) {
        setStudyTips(result.tips);
      }
    } catch (error) {
      console.error('Tips error:', error);
    } finally {
      setTipsLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        background: 'white',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <p>Generating AI insights...</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Exam Readiness Prediction */}
      {prediction && (
        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
          color: 'white',
          padding: '24px',
          borderRadius: '16px',
          marginBottom: '20px',
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
        }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '16px' }}>
            AI Readiness Score
          </h3>
          <div style={{
            fontSize: '3rem',
            fontWeight: 'bold',
            marginBottom: '8px'
          }}>
            {prediction.readinessScore}%
          </div>
          <p style={{ fontSize: '1.1rem', marginBottom: '16px' }}>
            Confidence: {prediction.confidence}
          </p>

          {prediction.recommendations && prediction.recommendations.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '16px',
              borderRadius: '8px',
              marginTop: '16px'
            }}>
              <h4 style={{ marginBottom: '12px', fontWeight: '600' }}>
                Recommendations:
              </h4>
              <ul style={{ paddingLeft: '20px' }}>
                {prediction.recommendations.map((rec, idx) => (
                  <li key={idx} style={{ marginBottom: '8px' }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {prediction.focusAreas && prediction.focusAreas.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '16px',
              borderRadius: '8px',
              marginTop: '12px'
            }}>
              <h4 style={{ marginBottom: '12px', fontWeight: '600' }}>
                Focus Areas:
              </h4>
              <ul style={{ paddingLeft: '20px' }}>
                {prediction.focusAreas.map((area, idx) => (
                  <li key={idx} style={{ marginBottom: '8px' }}>{area}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Study Tips Section */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: '600' }}>
          Get Subject-Specific Tips
        </h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'].map(subject => (
            <button
              key={subject}
              onClick={() => getSubjectTips(subject)}
              disabled={tipsLoading}
              style={{
                padding: '10px 16px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: tipsLoading ? 'wait' : 'pointer',
                fontWeight: '600',
                opacity: tipsLoading ? 0.6 : 1
              }}
            >
              {subject}
            </button>
          ))}
        </div>

        {tipsLoading && (
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p>Loading tips...</p>
          </div>
        )}

        {studyTips && studyTips.tips && (
          <div style={{
            marginTop: '20px',
            padding: '16px',
            background: '#f3f4f6',
            borderRadius: '8px'
          }}>
            <h4 style={{ marginBottom: '12px', fontWeight: '600' }}>Study Tips:</h4>
            {studyTips.tips.map((tip, idx) => (
              <div key={idx} style={{
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: idx < studyTips.tips.length - 1 ? '1px solid #e5e7eb' : 'none'
              }}>
                <p style={{ fontWeight: '600', marginBottom: '4px' }}>{tip.title}</p>
                <p style={{ fontSize: '0.9rem', color: '#4b5563' }}>{tip.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;