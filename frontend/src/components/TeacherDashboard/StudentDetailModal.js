// frontend/src/components/TeacherDashboard/StudentDetailModal.js
import React from 'react';

const StudentDetailModal = ({ student, onClose }) => {
  if (!student) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          marginBottom: '24px'
        }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.8rem' }}>
              {student.student?.name}
            </h2>
            <p style={{ margin: 0, color: '#6b7280' }}>
              {student.student?.email}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#e5e7eb',
              border: 'none',
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Detailed Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {[
            { label: 'Comprehension', value: `${student.patterns?.comprehensionScore || 0}%`, color: '#667eea' },
            { label: 'Reading Speed', value: `${student.patterns?.readingSpeed?.toFixed(1) || 0} p/m`, color: '#3b82f6' },
            { label: 'Avg Time/Page', value: `${student.patterns?.avgTimePerPage || 0}s`, color: '#f59e0b' },
            { label: 'Total Time', value: `${Math.round((student.patterns?.totalReadingTime || 0) / 60)}m`, color: '#22c55e' },
            { label: 'Highlights', value: student.highlights || 0, color: '#fbbf24' },
            { label: 'Notes', value: student.annotations || 0, color: '#8b5cf6' }
          ].map((stat, idx) => (
            <div key={idx} style={{
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '8px',
              borderLeft: `4px solid ${stat.color}`
            }}>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Page Insights */}
        {student.patterns && (
          <div>
            <h3 style={{ marginTop: '24px', marginBottom: '16px' }}>Page Insights</h3>
            
            <div style={{ display: 'grid', gap: '12px' }}>
              {student.patterns.mostVisitedPages?.length > 0 && (
                <div style={{
                  padding: '16px',
                  background: '#eff6ff',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                    📖 Most Visited Pages
                  </div>
                  <div style={{ color: '#1e40af' }}>
                    {student.patterns.mostVisitedPages.join(', ')}
                  </div>
                </div>
              )}

              {student.patterns.difficultPages?.length > 0 && (
                <div style={{
                  padding: '16px',
                  background: '#fee2e2',
                  borderRadius: '8px',
                  border: '1px solid #fecaca'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                    ⚠️ Difficult Pages (High Re-read Rate)
                  </div>
                  <div style={{ color: '#991b1b' }}>
                    {student.patterns.difficultPages.join(', ')}
                  </div>
                </div>
              )}

              {student.patterns.mostHighlightedPages?.length > 0 && (
                <div style={{
                  padding: '16px',
                  background: '#fffbeb',
                  borderRadius: '8px',
                  border: '1px solid #fde68a'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                    🖍️ Most Highlighted Pages
                  </div>
                  <div style={{ color: '#92400e' }}>
                    {student.patterns.mostHighlightedPages.join(', ')}
                  </div>
                </div>
              )}
            </div>

            {/* Active Reading Indicators */}
            <div style={{
              marginTop: '24px',
              padding: '20px',
              background: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0'
            }}>
              <h4 style={{ margin: '0 0 16px 0' }}>Active Reading Indicators</h4>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Highlight Rate:</span>
                  <strong>{student.patterns.activeReadingIndicators?.highlightRate?.toFixed(2) || 0} per page</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Annotation Rate:</span>
                  <strong>{student.patterns.activeReadingIndicators?.annotationRate?.toFixed(2) || 0} per page</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Selection Rate:</span>
                  <strong>{student.patterns.activeReadingIndicators?.selectionRate?.toFixed(2) || 0} per page</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDetailModal;