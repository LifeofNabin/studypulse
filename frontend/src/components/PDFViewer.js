import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PDFViewer.css'; // Make sure this matches your actual filename

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFViewer = ({ fileUrl, onLoadSuccess, onLoadError }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    if (onLoadSuccess) {
      onLoadSuccess({ numPages });
    }
  }, [onLoadSuccess]);

  const onDocumentLoadError = useCallback((error) => {
    setError('Failed to load PDF document');
    setLoading(false);
    if (onLoadError) {
      onLoadError(error);
    }
  }, [onLoadError]);

  const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages));
  const goToPage = (page) => {
    const pageNum = parseInt(page);
    if (pageNum >= 1 && pageNum <= numPages) {
      setPageNumber(pageNum);
    }
  };
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1.0);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>
        <h3>Unable to load PDF</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'white' }}>
      {/* Toolbar */}
      <div style={{ 
        padding: '10px', 
        background: '#f5f5f5', 
        borderBottom: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <button onClick={goToPrevPage} disabled={pageNumber <= 1}>←</button>
          <input
            type="number"
            value={pageNumber}
            onChange={(e) => goToPage(e.target.value)}
            min="1"
            max={numPages}
            style={{ width: '50px', margin: '0 10px' }}
          />
          <span>of {numPages}</span>
          <button onClick={goToNextPage} disabled={pageNumber >= numPages}>→</button>
        </div>
        <div>
          <button onClick={zoomOut} disabled={scale <= 0.5}>−</button>
          <span style={{ margin: '0 10px' }}>{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} disabled={scale >= 3.0}>+</button>
          <button onClick={resetZoom} style={{ marginLeft: '10px' }}>Reset</button>
        </div>
      </div>

      {/* PDF Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px', textAlign: 'center' }}>
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<p>Loading document...</p>}
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

export default PDFViewer;