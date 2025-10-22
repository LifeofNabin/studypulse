import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// ✅ Fixed worker configuration with https protocol
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const StudentPDFViewer = ({ fileUrl, roomId, sessionId, onLoadSuccess, onLoadError }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }) => {
      setNumPages(numPages);
      setLoading(false);
      setError(null);
      if (onLoadSuccess) onLoadSuccess({ numPages });
    },
    [onLoadSuccess]
  );

  const onDocumentLoadError = useCallback(
    (err) => {
      console.error('PDF Load Error:', err);
      setError('Failed to load PDF document. Please check the file URL and try again.');
      setLoading(false);
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

  // Inline styles to replace missing CSS
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
      gap: '16px'
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
      padding: '6px 12px',
      background: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      transition: 'background 0.2s'
    },
    buttonDisabled: {
      background: '#9ca3af',
      cursor: 'not-allowed'
    },
    input: {
      width: '60px',
      padding: '6px 8px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      textAlign: 'center',
      fontSize: '14px'
    },
    document: {
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '20px'
    },
    loading: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.2rem',
      color: '#6b7280'
    },
    error: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      color: '#ef4444',
      padding: '20px',
      textAlign: 'center'
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div>📄 Loading PDF...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.error}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
        <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px' }}>
          {error}
        </div>
        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          File URL: {fileUrl?.substring(0, 50)}...
        </div>
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
              ...(pageNumber <= 1 ? styles.buttonDisabled : {})
            }}
          >
            ←
          </button>
          <input
            type="number"
            value={pageNumber}
            onChange={(e) => goToPage(e.target.value)}
            min="1"
            max={numPages}
            style={styles.input}
          />
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            of {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            style={{
              ...styles.button,
              ...(pageNumber >= numPages ? styles.buttonDisabled : {})
            }}
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
              ...(scale <= 0.5 ? styles.buttonDisabled : {})
            }}
          >
            −
          </button>
          <span style={{ fontSize: '14px', fontWeight: '600', minWidth: '60px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            style={{
              ...styles.button,
              ...(scale >= 3.0 ? styles.buttonDisabled : {})
            }}
          >
            +
          </button>
          <button onClick={resetZoom} style={styles.button}>
            Reset
          </button>
        </div>
      </div>

      {/* PDF Document */}
      <div style={styles.document}>
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div>Loading document...</div>}
          error={<div style={{ color: '#ef4444' }}>Error loading PDF</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
};

export default StudentPDFViewer;