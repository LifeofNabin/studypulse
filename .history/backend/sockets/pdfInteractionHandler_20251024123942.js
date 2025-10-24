// backend/socket/pdfInteractionHandler.js
const PDFInteraction = require('../models/PDFInteraction');

const setupPDFInteractionHandlers = (io, socket) => {
  console.log(`📚 PDF Interaction handler attached for socket: ${socket.id}`);

  // Handle PDF interaction events
  socket.on('pdf_interaction', async (data) => {
    try {
      const { session_id, room_id, event_type, data: eventData, timestamp } = data;
      const userId = socket.userId; // Set from auth middleware

      console.log(`📄 PDF Event: ${event_type} - Session: ${session_id}`);

      // Find or create interaction document
      let interaction = await PDFInteraction.findOne({ sessionId: session_id });

      if (!interaction) {
        interaction = new PDFInteraction({
          sessionId: session_id,
          roomId: room_id,
          userId: userId,
          interactions: [],
          analytics: {
            pagesVisited: new Map(),
            pageTimeSpent: new Map(),
            highlights: [],
            annotations: [],
            textSelections: [],
            scrollEvents: [],
            zoomEvents: [],
            readingPatterns: {}
          }
        });
      }

      // Add interaction event
      interaction.interactions.push({
        eventType: event_type,
        data: eventData,
        timestamp: new Date(timestamp)
      });

      // Update analytics based on event type
      switch (event_type) {
        case 'pdf_loaded':
          interaction.analytics.totalPages = eventData.totalPages;
          console.log(`📖 PDF Loaded: ${eventData.totalPages} pages`);
          break;

        case 'page_time':
          const pageStr = eventData.page.toString();
          const currentTimeSpent = interaction.analytics.pageTimeSpent.get(pageStr) || 0;
          interaction.analytics.pageTimeSpent.set(pageStr, currentTimeSpent + eventData.timeSpent);
          
          const currentVisits = interaction.analytics.pagesVisited.get(pageStr) || 0;
          interaction.analytics.pagesVisited.set(pageStr, currentVisits + 1);
          
          console.log(`⏱️  Page ${eventData.page}: ${Math.round(eventData.timeSpent/1000)}s (total: ${Math.round((currentTimeSpent + eventData.timeSpent)/1000)}s)`);
          break;

        case 'text_selection':
          interaction.analytics.textSelections.push({
            text: eventData.text.substring(0, 200), // Limit storage
            page: eventData.page,
            length: eventData.length,
            timestamp: new Date(eventData.timestamp)
          });
          console.log(`📝 Text selected on page ${eventData.page}: ${eventData.length} chars`);
          break;

        case 'highlight':
          interaction.analytics.highlights.push({
            text: eventData.text.substring(0, 200),
            page: eventData.page,
            color: eventData.color,
            timestamp: new Date(eventData.timestamp)
          });
          console.log(`🖍️  Highlighted on page ${eventData.page}`);
          
          // Notify teacher in real-time
          io.to(`room_${room_id}_teachers`).emit('student_highlight', {
            studentId: userId,
            page: eventData.page,
            text: eventData.text.substring(0, 100)
          });
          break;

        case 'annotation':
          interaction.analytics.annotations.push({
            text: eventData.text.substring(0, 200),
            note: eventData.note,
            page: eventData.page,
            timestamp: new Date(eventData.timestamp)
          });
          console.log(`📌 Annotation added on page ${eventData.page}`);
          
          // Notify teacher
          io.to(`room_${room_id}_teachers`).emit('student_annotation', {
            studentId: userId,
            page: eventData.page,
            notePreview: eventData.note.substring(0, 50)
          });
          break;

        case 'scroll_pattern':
          interaction.analytics.scrollEvents.push({
            page: eventData.page,
            scrollSpeed: eventData.avgScrollSpeed,
            scrollDirection: eventData.scrollDirection,
            timestamp: new Date()
          });
          break;

        case 'zoom':
          interaction.analytics.zoomEvents.push({
            page: eventData.page,
            scale: eventData.scale,
            action: eventData.action,
            timestamp: new Date()
          });
          console.log(`🔍 Zoom ${eventData.action} on page ${eventData.page}: ${Math.round(eventData.scale * 100)}%`);
          break;

        case 'page_navigation':
          console.log(`📄 Navigation: Page ${eventData.from} → ${eventData.to} (${eventData.direction})`);
          break;
      }

      // Calculate and update reading patterns
      interaction.analytics.readingPatterns = interaction.calculateReadingPatterns();
      interaction.updatedAt = new Date();
      await interaction.save();

      // Emit real-time analytics to teacher dashboard
      if (event_type === 'page_time' || event_type === 'highlight' || event_type === 'annotation') {
        io.to(`room_${room_id}_teachers`).emit('pdf_analytics_update', {
          sessionId: session_id,
          userId: userId,
          analytics: interaction.analytics.readingPatterns,
          event: event_type
        });
      }

      // Detect struggling student and alert teacher
      const patterns = interaction.analytics.readingPatterns;
      if (patterns && patterns.comprehensionScore < 30 && patterns.engagementLevel === 'low') {
        io.to(`room_${room_id}_teachers`).emit('student_struggling_alert', {
          sessionId: session_id,
          userId: userId,
          comprehensionScore: patterns.comprehensionScore,
          difficultPages: patterns.difficultPages
        });
      }

    } catch (error) {
      console.error('❌ Error handling PDF interaction:', error);
      socket.emit('pdf_interaction_error', { 
        error: 'Failed to save interaction',
        details: error.message 
      });
    }
  });

  // Get PDF analytics for current session
  socket.on('get_pdf_analytics', async (data) => {
    try {
      const { session_id } = data;
      console.log(`📊 Fetching analytics for session: ${session_id}`);

      const analytics = await PDFInteraction.getSessionAnalytics(session_id);

      if (analytics) {
        socket.emit('pdf_analytics', {
          sessionId: session_id,
          analytics: analytics
        });
        console.log(`✅ Analytics sent for session: ${session_id}`);
      } else {
        socket.emit('pdf_analytics', {
          sessionId: session_id,
          analytics: null,
          message: 'No interaction data found yet'
        });
      }
    } catch (error) {
      console.error('❌ Error fetching PDF analytics:', error);
      socket.emit('pdf_analytics_error', { error: error.message });
    }
  });

  // Get teacher dashboard analytics (all students in room)
  socket.on('get_room_pdf_analytics', async (data) => {
    try {
      const { room_id } = data;
      console.log(`📊 Fetching room analytics: ${room_id}`);

      const analytics = await PDFInteraction.getTeacherAnalytics(room_id);

      socket.emit('room_pdf_analytics', {
        roomId: room_id,
        analytics: analytics
      });
      console.log(`✅ Room analytics sent: ${room_id}`);
    } catch (error) {
      console.error('❌ Error fetching room analytics:', error);
      socket.emit('room_pdf_analytics_error', { error: error.message });
    }
  });

  // Export student's PDF interactions as report
  socket.on('export_pdf_report', async (data) => {
    try {
      const { session_id } = data;
      const interaction = await PDFInteraction.findOne({ sessionId: session_id })
        .populate('userId', 'name email')
        .populate('roomId', 'title subject');

      if (!interaction) {
        socket.emit('export_pdf_report_error', { error: 'No data found' });
        return;
      }

      const report = {
        student: interaction.userId,
        room: interaction.roomId,
        sessionDate: interaction.createdAt,
        
        summary: {
          totalPages: interaction.analytics.totalPages,
          pagesVisited: Array.from(interaction.analytics.pagesVisited.keys()).length,
          totalReadingTime: interaction.analytics.readingPatterns.totalReadingTime,
          avgTimePerPage: interaction.analytics.readingPatterns.avgTimePerPage,
          readingSpeed: interaction.analytics.readingPatterns.readingSpeed
        },
        
        engagement: {
          comprehensionScore: interaction.analytics.readingPatterns.comprehensionScore,
          engagementLevel: interaction.analytics.readingPatterns.engagementLevel,
          focusQuality: interaction.analytics.readingPatterns.focusQuality,
          highlights: interaction.analytics.highlights.length,
          annotations: interaction.analytics.annotations.length,
          textSelections: interaction.analytics.textSelections.length
        },
        
        insights: {
          mostVisitedPages: interaction.analytics.readingPatterns.mostVisitedPages,
          difficultPages: interaction.analytics.readingPatterns.difficultPages,
          mostHighlightedPages: interaction.analytics.readingPatterns.mostHighlightedPages,
          activeReadingIndicators: interaction.analytics.readingPatterns.activeReadingIndicators
        },
        
        highlights: interaction.analytics.highlights,
        annotations: interaction.analytics.annotations
      };

      socket.emit('pdf_report_data', report);
      console.log(`✅ PDF report exported for session: ${session_id}`);
    } catch (error) {
      console.error('❌ Error exporting PDF report:', error);
      socket.emit('export_pdf_report_error', { error: error.message });
    }
  });
};

module.exports = setupPDFInteractionHandlers;