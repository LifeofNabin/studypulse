import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const StudentPDFViewer = ({ roomId, sessionId }) => {
  const [pdfInfo, setPdfInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');

  useEffect(() => {
    fetchPDFInfo();
    return () => {
      // Cleanup blob URL on unmount
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [roomId]);

  const fetchPDFInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // First, get PDF info
      const infoResponse = await axios.get(
        `${API_BASE_URL}/api/rooms/${roomId}/pdf-info`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (infoResponse.data.has_pdf) {
        setPdfInfo(infoResponse.data);
        
        // Then fetch the actual PDF file with proper authorization
        const pdfResponse = await axios.get(
          `${API_BASE_URL}/api/rooms/${roomId}/pdf`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            responseType: 'blob'
          }
        );

        // Create blob URL for iframe - specify PDF type
        const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);
      } else {
        setPdfInfo(null);
      }
    } catch (error) {
      console.error('Error fetching PDF:', error);
      setError('Failed to load PDF. Make sure you have joined the room.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.get(
        `${API_BASE_URL}/api/rooms/${roomId}/pdf`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          responseType: 'blob'
        }
      );

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfInfo.name || 'study-material.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF');
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        Loading study material...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        background: '#fef2f2',
        borderRadius: '8px',
        border: '1px solid #fecaca',
        color: '#dc2626'
      }}>
        {error}
      </div>
    );
  }

  if (!pdfInfo || !pdfInfo.has_pdf) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
        <h3 style={{ color: '#1f2937', marginBottom: '8px' }}>No Study Material</h3>
        <p style={{ color: '#6b7280' }}>
          Your teacher hasn't uploaded any PDF for this session yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'white',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden'
    }}>
      {/* PDF Header */}
      <div style={{
        padding: '16px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '24px' }}>📄</div>
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: '16px', 
              fontWeight: '600',
              color: '#1f2937'
            }}>
              {pdfInfo.name}
            </h3>
            <p style={{ 
              margin: '4px 0 0 0', 
              fontSize: '14px', 
              color: '#6b7280' 
            }}>
              Uploaded: {new Date(pdfInfo.uploaded_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <button
          onClick={handleDownload}
          style={{
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            borderRadius: '6px',
            border: 'none',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          Download
        </button>
      </div>

      {/* PDF Viewer using object tag instead of iframe */}
      <div style={{ 
        flex: 1, 
        position: 'relative',
        minHeight: '600px',
        background: '#525659'
      }}>
        {pdfBlobUrl ? (
          <object
            data={pdfBlobUrl}
            type="application/pdf"
            width="100%"
            height="100%"
            style={{
              border: 'none'
            }}
          >
            <embed
              src={pdfBlobUrl}
              type="application/pdf"
              width="100%"
              height="100%"
            />
            <div style={{ 
              padding: '20px', 
              textAlign: 'center',
              color: 'white'
            }}>
              <p>Your browser doesn't support embedded PDFs.</p>
              <button 
                onClick={handleDownload}
                style={{
                  marginTop: '10px',
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Download PDF Instead
              </button>
            </div>
          </object>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'white' }}>
            Loading PDF viewer...
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentPDFViewer;