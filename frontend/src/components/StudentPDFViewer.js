import React, { useState, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// ✅ Fixed worker configuration
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const StudentPDFViewer = ({ roomId, sessionId, onLoadSuccess, onLoadError }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  // Fetch PDF from backend
  useEffect(() => {
    const fetchPDF = async () => {
      if (!roomId) {
        setError('Room ID is missing');
        setLoading(false);
        return;
      }

      try {
        console.log('📄 Fetching PDF for room:', roomId);
        const token = localStorage.getItem('token');
        
        if (!token) {
          throw new Error('Authentication token not found');
        }

        // Use the new download endpoint
        const downloadUrl = `${API_BASE_URL}/api/rooms/${roomId}/pdf/download`;
        console.log('🔗 Requesting:', downloadUrl);
        
        const response = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }

        // Convert to blob for react-pdf
        const blob = await response.blob();
        console.log('📦 Blob received, size:', blob.size, 'bytes');
        
        if (blob.size === 0) {
          throw new Error('Received empty PDF file');
        }

        const blobUrl = URL.createObjectURL(blob);
        console.log('✅ PDF loaded successfully');
        setPdfUrl(blobUrl);
        setLoading(false);

      } catch (err) {
        console.error('❌ PDF Fetch Error:', err);
        setError(`Failed to load PDF: ${err.message}`);
        setLoading(false);
        if (onLoadError) onLoadError(err);
      }
    };

    fetchPDF();

    // Cleanup blob URL on unmount
    return () => {
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [roomId]);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }) => {
      console.log('📄 PDF document loaded. Total pages:', numPages);
      setNumPages(numPages);
      setError(null);
      if (onLoadSuccess) onLoadSuccess({ numPages });
    },
    [onLoadSuccess]
  );

  const onDocumentLoadError = useCallback(
    (err) => {
      console.error('❌ PDF Document Load Error:', err);
      setError('Failed to render PDF document. The file may be corrupted.');
      if (onLoadError) onLoadError(err);
    },
    [onLoadError]
  );

  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages));
  
  const goToPage = (page) => {
    const pageNum = parseInt(page, 10);
    if (pageNum >= 1 && pageNum <= numPages) {
      setPageNumber(pageNum);
    }
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1.0);

  // Inline styles
  const styles = {
    container: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#f5f5f5'
    },
    toolbar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      background: 'white',
      borderBottom: '1px solid #e0e0e0',
      gap: '16px',
      flexWrap: 'wrap'
    },
    pageControls: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    zoomControls: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    button: {
      padding: '8px 16px',
      background: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      transition: 'all 0.2s',
      minWidth: '40px'
    },
    buttonDisabled: {
      background: '#9ca3af',
      cursor: 'not-allowed',
      opacity: 0.5
    },
    input: {
      width: '60px',
      padding: '8px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: '600'
    },
    document: {
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '20px',
      background: '#f5f5f5'
    },
    loading: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.2rem',
      color: '#6b7280',
      flexDirection: 'column',
      gap: '16px'
    },
    spinner: {
      width: '50px',
      height: '50px',
      border: '5px solid #e5e7eb',
      borderTop: '5px solid #3b82f6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    error: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      color: '#ef4444',
      padding: '40px',
      textAlign: 'center',
      gap: '16px'
    },
    errorDetails: {
      background: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      padding: '16px',
      fontSize: '0.9rem',
      color: '#991b1b',
      maxWidth: '500px',
      width: '100%'
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>Loading PDF...</div>
        <div style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
          Room: {roomId?.substring(0, 8)}...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.error}>
        <div style={{ fontSize: '4rem' }}>⚠️</div>
        <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#dc2626' }}>
          Unable to Load PDF
        </div>
        <div style={styles.errorDetails}>
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>Error Details:</div>
          <div style={{ marginBottom: '12px' }}>{error}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            <div>Room ID: {roomId}</div>
            <div>Endpoint: {API_BASE_URL}/api/rooms/{roomId}/pdf/download</div>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            ...styles.button,
            background: '#ef4444',
            padding: '12px 24px',
            fontSize: '1rem'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <div>Preparing PDF...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.pageControls}>
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            style={{
              ...styles.button,
              ...(pageNumber <= 1 ? styles.buttonDisabled : {}),
              fontSize: '18px'
            }}
            title="Previous Page"
          >
            ←
          </button>
          <input
            type="number"
            value={pageNumber}
            onChange={(e) => goToPage(e.target.value)}
            min="1"
            max={numPages || 1}
            style={styles.input}
            title="Current Page"
          />
          <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600' }}>
            / {numPages || '?'}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            style={{
              ...styles.button,
              ...(pageNumber >= numPages ? styles.buttonDisabled : {}),
              fontSize: '18px'
            }}
            title="Next Page"
          >
            →
          </button>
        </div>

        <div style={styles.zoomControls}>
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            style={{
              ...styles.button,
              ...(scale <= 0.5 ? styles.buttonDisabled : {}),
              fontSize: '20px'
            }}
            title="Zoom Out"
          >
            −
          </button>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '700', 
            minWidth: '60px', 
            textAlign: 'center',
            color: '#1f2937'
          }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            style={{
              ...styles.button,
              ...(scale >= 3.0 ? styles.buttonDisabled : {}),
              fontSize: '20px'
            }}
            title="Zoom In"
          >
            +
          </button>
          <button 
            onClick={resetZoom} 
            style={styles.button}
            title="Reset Zoom"
          >
            Reset
          </button>
        </div>
      </div>

      {/* PDF Document */}
      <div style={styles.document}>
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', color: '#6b7280' }}>
                Loading document...
              </div>
            </div>
          }
          error={
            <div style={{ padding: '20px', textAlign: 'center', color: '#ef4444' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                Error rendering PDF
              </div>
            </div>
          }
          options={{
            cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/standard_fonts/`,
          }}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            loading={
              <div style={{ 
                width: '100%', 
                height: '600px', 
                background: '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed #e5e7eb',
                borderRadius: '8px'
              }}>
                <div style={{ color: '#9ca3af' }}>Loading page {pageNumber}...</div>
              </div>
            }
          />
        </Document>
      </div>
    </div>
  );
};

export default StudentPDFViewer;