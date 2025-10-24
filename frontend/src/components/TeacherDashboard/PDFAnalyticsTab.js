// frontend/src/components/TeacherDashboard/PDFAnalyticsTab.js
import React from 'react';
import PDFAnalytics from './PDFAnalytics';

const PDFAnalyticsTab = ({ rooms, selectedRoom, setSelectedRoom }) => {
  if (selectedRoom) {
    return (
      <div>
        <button
          onClick={() => setSelectedRoom(null)}
          style={{
            background: '#e5e7eb',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            marginBottom: '20px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ← Back to Room Selection
        </button>
        <PDFAnalytics room={selectedRoom} />
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📊 PDF Reading Analytics</h3>
          <p style={{ color: '#6b7280', margin: '8px 0 0 0' }}>
            Select a room to view detailed PDF interaction analytics
          </p>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px', 
          background: '#f9fafb',
          borderRadius: '12px',
          border: '2px dashed #e5e7eb',
          marginTop: '20px'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📚</div>
          <p style={{ fontSize: '1.1rem', color: '#374151', marginBottom: '8px' }}>
            No study rooms available
          </p>
          <p style={{ color: '#6b7280' }}>
            Create a room first to view PDF analytics
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
          marginTop: '20px'
        }}>
          {rooms.map(room => (
            <div 
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '2px solid transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                e.currentTarget.style.borderColor = '#3b82f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <div style={{
                display: 'inline-block',
                padding: '6px 12px',
                background: '#eff6ff',
                color: '#3b82f6',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '600',
                marginBottom: '12px'
              }}>
                {room.subject}
              </div>
              
              <h4 style={{ 
                margin: '0 0 12px 0', 
                fontSize: '1.3rem',
                color: '#1f2937'
              }}>
                {room.title}
              </h4>

              {room.description && (
                <p style={{ 
                  color: '#6b7280', 
                  fontSize: '0.9rem',
                  marginBottom: '16px',
                  lineHeight: '1.5'
                }}>
                  {room.description}
                </p>
              )}

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Students</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>
                    {room.students_count || 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Status</div>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '600',
                    color: room.status === 'active' ? '#22c55e' : '#f59e0b',
                    textTransform: 'capitalize'
                  }}>
                    ● {room.status}
                  </div>
                </div>
              </div>

              {room.pdf_file && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: '#f0fdf4',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#065f46' }}>
                      PDF Uploaded
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {room.pdf_file.name?.substring(0, 30)}...
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRoom(room);
                }}
                style={{
                  marginTop: '16px',
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                📊 View Analytics
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PDFAnalyticsTab;