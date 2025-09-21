import { useRef, useEffect } from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';

const PDFViewerComponent = ({ pdfUrl, onInteraction, onPageChange, setPdfBounds }) => {
  const viewerRef = useRef(null);

  useEffect(() => {
    const updateBounds = () => {
      if (viewerRef.current) {
        const rect = viewerRef.current.getBoundingClientRect();
        setPdfBounds({
          x: rect.left / window.innerWidth,
          y: rect.top / window.innerHeight,
          width: rect.width / window.innerWidth,
          height: rect.height / window.innerHeight,
        });
      }
    };
    updateBounds();
    window.addEventListener('resize', updateBounds);

    const handleActivity = () => onInteraction('activity');
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [setPdfBounds, onInteraction]);

  return (
    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.338/build/pdf.worker.min.js">
      <div ref={viewerRef}>
        <Viewer fileUrl={pdfUrl} onPageChange={(e) => onPageChange(e.currentPage)} />
      </div>
    </Worker>
  );
};

export default PDFViewerComponent;