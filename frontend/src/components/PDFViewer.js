// src/components/PDFViewer.js
import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PDFViewer.css';

// ✅ Correct worker setup for pdfjs v3+
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.js',
  import.meta.url
).toString();

const PDFViewer = ({ fileUrl, onLoadSuccess, onLoadError }) => {
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
      console.error(err);
      setError('Failed to load PDF document');
      setLoading(false);
      if (onLoadError) onLoadError(err);
    },
    [onLoadError]
  );

  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages));
  const goToPage = (page) => {
    const pageNum = parseInt(page);
    if (pageNum >= 1 && pageNum <= numPages) setPageNumber(pageNum);
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1.0);

  if (loading) return <div className="pdf-loading">Loading PDF...</div>;
  if (error) return <div className="pdf-error">{error}</div>;

  return (
    <div className="pdf-viewer-container">
      {/* Toolbar */}
      <div className="pdf-toolbar">
        <div className="page-controls">
          <button onClick={goToPrevPage} disabled={pageNumber <= 1}>←</button>
          <input
            type="number"
            value={pageNumber}
            onChange={(e) => goToPage(e.target.value)}
            min="1"
            max={numPages}
          />
          <span>of {numPages}</span>
          <button onClick={goToNextPage} disabled={pageNumber >= numPages}>→</button>
        </div>

        <div className="zoom-controls">
          <button onClick={zoomOut} disabled={scale <= 0.5}>−</button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} disabled={scale >= 3.0}>+</button>
          <button onClick={resetZoom}>Reset</button>
        </div>
      </div>

      {/* PDF Document */}
      <div className="pdf-document">
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
        >
          <Page pageNumber={pageNumber} scale={scale} />
        </Document>
      </div>
    </div>
  );
};

export default PDFViewer;
