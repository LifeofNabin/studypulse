import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const StudentPDFViewer = ({ roomId, sessionId, onLoadSuccess, onLoadError, socketRef }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  
  // ✨ NEW: Interaction tracking states
  const [selectedText, setSelectedText] = useState('');
  const [highlights, setHighlights] = useState([]);
  const [showStats, setShowStats] = useState(false);
  
  const isMountedRef = useRef(true);
  const documentRef = useRef(null);
  const pdfContainerRef = useRef(null);
  
  // ✨ NEW: Interaction tracking refs
  const pageStartTimeRef = useRef({});
  const scrollPositionRef = useRef(0);
  const lastScrollTimeRef = useRef(Date.now());
  const interactionDataRef = useRef({
    pageVisits: {},
    pageTimeSpent: {},
    highlights: [],
    textSelections: [],
    scrollEvents: [],
    zoomEvents: []
  });

  // Fetch PDF from backend (UNCHANGED - your working code)
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

    return () => {
      isMountedRef.current = false;
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [roomId, onLoadError]);

  // ✨ NEW: Track page time
  useEffect(() => {
    if (!pageStartTimeRef.current[pageNumber]) {
      pageStartTimeRef.current[pageNumber] = Date.now();
    }

    return () => {
      if (pageStartTimeRef.current[pageNumber]) {
        const timeSpent = Date.now() - pageStartTimeRef.current[pageNumber];
        
        interactionDataRef.current.pageTimeSpent[pageNumber] = 
          (interactionDataRef.current.pageTimeSpent[pageNumber] || 0) + timeSpent;
        
        interactionDataRef.current.pageVisits[pageNumber] = 
          (interactionDataRef.current.pageVisits[pageNumber] || 0) + 1;

        sendInteractionData('page_time', {
          page: pageNumber,
          timeSpent: timeSpent,
          totalTimeOnPage: interactionDataRef.current.pageTimeSpent[pageNumber],
          visitCount: interactionDataRef.current.pageVisits[pageNumber]
        });
      }
    };
  }, [pageNumber]);

  // ✨ NEW: Track text selection
  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text.length > 5) { // Only track meaningful selections
        const selectionData = {
          text: text.substring(0, 200), // Limit text length
          page: pageNumber,
          length: text.length,
          timestamp: Date.now()
        };

        interactionDataRef.current.textSelections.push(selectionData);
        setSelectedText(text);

        sendInteractionData('text_selection', selectionData);
        
        console.log('📝 Text selected:', text.substring(0, 50) + '...');
      }
    };

    document.addEventListener('mouseup', handleTextSelection);
    return () => document.removeEventListener('mouseup', handleTextSelection);
  }, [pageNumber]);

  // ✨ NEW: Track scrolling
  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = pdfContainerRef.current?.scrollTop || 0;
      const currentTime = Date.now();
      const timeDiff = currentTime - lastScrollTimeRef.current;
      
      if (timeDiff > 200) { // Debounce
        const scrollData = {
          page: pageNumber,
          scrollPosition: currentScroll,
          scrollDelta: currentScroll - scrollPositionRef.current,
          timestamp: currentTime
        };

        interactionDataRef.current.scrollEvents.push(scrollData);
        scrollPositionRef.current = currentScroll;
        lastScrollTimeRef.current = currentTime;
      }
    };

    const container = pdfContainerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [pageNumber]);

  // ✨ NEW: Send interaction data via Socket.IO
  const sendInteractionData = (eventType, data) => {
    if (socketRef?.current?.connected) {
      socketRef.current.emit('pdf_interaction', {
        session_id: sessionId,
        room_id: roomId,
        event_type: eventType,
        data: data,
        timestamp: Date.now()
      });
      console.log('📊 Sent interaction:', eventType, data);
    }
  };

  const onDocumentLoadSuccess = useCallback(
    (pdf) => {
      console.log('📄 PDF document loaded. Total pages:', pdf.numPages);
      documentRef.current = pdf;
      setNumPages(pdf.numPages);
      setError(null);
      
      // Initialize tracking for all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        interactionDataRef.current.pageVisits[i] = 0;
        interactionDataRef.current.pageTimeSpent[i] = 0;
      }
      
      sendInteractionData('pdf_loaded', { totalPages: pdf.numPages });
      if (onLoadSuccess) onLoadSuccess({ numPages: pdf.numPages });
    },
    [onLoadSuccess]
  );

  const onDocumentLoadError = useCallback(
    (err) => {
      console.error('❌ PDF Document Load Error:', err);
      setError('Failed to render PDF document');
      if (onLoadError) onLoadError(err);
    },
    [onLoadError]
  );

  const goToPrevPage = () => {
    const newPage = Math.max(pageNumber - 1, 1);
    sendInteractionData('page_navigation', { from: pageNumber, to: newPage, direction: 'previous' });
    setPageNumber(newPage);
  };

  const goToNextPage = () => {
    const newPage = Math.min(pageNumber + 1, numPages);
    sendInteractionData('page_navigation', { from: pageNumber, to: newPage, direction: 'next' });
    setPageNumber(newPage);
  };
  
  const goToPage = (page) => {
    const pageNum = parseInt(page, 10);
    if (pageNum >= 1 && pageNum <= numPages) {
      sendInteractionData('page_navigation', { from: pageNumber, to: pageNum, direction: 'jump' });
      setPageNumber(pageNum);
    }
  };

  const zoomIn = () => {
    const newScale = Math.min(scale + 0.2, 3.0);
    setScale(newScale);
    sendInteractionData('zoom', { scale: newScale, action: 'zoom_in', page: pageNumber });
  };

  const zoomOut = () => {
    const newScale = Math.max(scale - 0.2, 0.5);
    setScale(newScale);
    sendInteractionData('zoom', { scale: newScale, action: 'zoom_out', page: pageNumber });
  };

  const resetZoom = () => {
    setScale(1.0);
    sendInteractionData('zoom', { scale: 1.0, action: 'reset', page: pageNumber });
  };

  // ✨ NEW: Highlight feature
  const handleHighlight = () => {
    if (selectedText.length > 0) {
      const highlight = {
        id: Date.now(),
        text: selectedText.substring(0, 100),
        page: pageNumber,
        timestamp: Date.now()
      };

      setHighlights([...highlights, highlight]);
      interactionDataRef.current.highlights.push(highlight);
      
      sendInteractionData('highlight', highlight);
      setSelectedText('');
      
      console.log('🖍️ Text highlighted on page', pageNumber);
    }
  };

  // ✨ NEW: Calculate analytics
  const getAnalytics = () => {
    const totalTime = Object.values(interactionDataRef.current.pageTimeSpent)
      .reduce((sum, time) => sum + time, 0);
    
    const pagesVisited = Object.keys(interactionDataRef.current.pageVisits)
      .filter(page => interactionDataRef.current.pageVisits[page] > 0).length;
    
    const avgTimePerPage = pagesVisited > 0 ? totalTime / pagesVisited / 1000 : 0;

    return {
      totalTime: Math.round(totalTime / 1000),
      pagesVisited,
      avgTimePerPage: Math.round(avgTimePerPage),
      totalHighlights: highlights.length,
      totalSelections: interactionDataRef.current.textSelections.length
    };
  };

  const documentOptions = useMemo(() => ({
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  }), []);

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
      gap: '12px',
      flexWrap: 'wrap'
    },
    toolGroup: {
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
    highlightButton: {
      padding: '8px 14px',
      background: '#fbbf24',
      color: '#92400e',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600'
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
    statsBar: {
      padding: '10px 16px',
      background: '#f9fafb',
      borderTop: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-around',
      fontSize: '11px',
      gap: '12px',
      flexWrap: 'wrap'
    },
    statItem: {
      textAlign: 'center',
      minWidth: '70px'
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
      </div>
    );
  }

  const analytics = getAnalytics();

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolGroup}>
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
            max={numPages || 1}
            style={styles.input}
          />
          <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600' }}>
            / {numPages || '?'}
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

        {/* ✨ NEW: Highlight button */}
        <div style={styles.toolGroup}>
          <button
            onClick={handleHighlight}
            disabled={!selectedText}
            style={{
              ...styles.highlightButton,
              opacity: selectedText ? 1 : 0.5,
              cursor: selectedText ? 'pointer' : 'not-allowed'
            }}
          >
            🖍️ Highlight
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            style={{
              ...styles.button,
              background: showStats ? '#10b981' : '#6b7280'
            }}
          >
            📊 Stats
          </button>
        </div>

        <div style={styles.toolGroup}>
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
      <div ref={pdfContainerRef} style={styles.document}>
        <Document
          key={pdfUrl}
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          options={documentOptions}
        >
          <Page
            key={`page-${pageNumber}`}
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {/* ✨ NEW: Stats Bar */}
      {showStats && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <div style={{ fontWeight: '700', color: '#1a1a2e', fontSize: '16px' }}>
              {analytics.pagesVisited}/{numPages}
            </div>
            <div style={{ color: '#6b7280', marginTop: '2px' }}>Pages</div>
          </div>
          <div style={styles.statItem}>
            <div style={{ fontWeight: '700', color: '#1a1a2e', fontSize: '16px' }}>
              {analytics.avgTimePerPage}s
            </div>
            <div style={{ color: '#6b7280', marginTop: '2px' }}>Avg/Page</div>
          </div>
          <div style={styles.statItem}>
            <div style={{ fontWeight: '700', color: '#1a1a2e', fontSize: '16px' }}>
              {analytics.totalHighlights}
            </div>
            <div style={{ color: '#6b7280', marginTop: '2px' }}>Highlights</div>
          </div>
          <div style={styles.statItem}>
            <div style={{ fontWeight: '700', color: '#1a1a2e', fontSize: '16px' }}>
              {analytics.totalSelections}
            </div>
            <div style={{ color: '#6b7280', marginTop: '2px' }}>Selections</div>
          </div>
          <div style={styles.statItem}>
            <div style={{ fontWeight: '700', color: '#1a1a2e', fontSize: '16px' }}>
              {Math.floor(analytics.totalTime / 60)}m
            </div>
            <div style={{ color: '#6b7280', marginTop: '2px' }}>Total Time</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPDFViewer;