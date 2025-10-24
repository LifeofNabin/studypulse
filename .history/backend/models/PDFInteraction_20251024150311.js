// backend/models/PDFInteraction.js
const mongoose = require('mongoose');

const pdfInteractionSchema = new mongoose.Schema({
  sessionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Session',
    required: true, 
    index: true 
  },
  roomId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Room',
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  
  // Raw interaction events
  interactions: [{
    eventType: {
      type: String,
      enum: [
        'pdf_loaded', 
        'page_time', 
        'page_navigation', 
        'text_selection', 
        'highlight', 
        'annotation', 
        'scroll_pattern', 
        'zoom'
      ],
      required: true
    },
    data: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Processed analytics
  analytics: {
    totalPages: Number,
    
    // Page-level metrics
    pagesVisited: { 
      type: Map, 
      of: Number 
    }, // page number -> visit count
    
    pageTimeSpent: { 
      type: Map, 
      of: Number 
    }, // page number -> milliseconds
    
    // Engagement data
    highlights: [{
      text: String,
      page: Number,
      color: String,
      timestamp: Date
    }],
    
    annotations: [{
      text: String,
      note: String,
      page: Number,
      timestamp: Date
    }],
    
    textSelections: [{
      text: String,
      page: Number,
      length: Number,
      timestamp: Date
    }],
    
    scrollEvents: [{
      page: Number,
      scrollSpeed: Number,
      scrollDirection: String,
      timestamp: Date
    }],
    
    zoomEvents: [{
      page: Number,
      scale: Number,
      action: String,
      timestamp: Date
    }],
    
    // Computed reading patterns
    readingPatterns: {
      avgTimePerPage: Number, // seconds
      totalReadingTime: Number, // seconds
      readingSpeed: Number, // pages per minute
      
      mostVisitedPages: [Number],
      leastVisitedPages: [Number],
      
      mostHighlightedPages: [Number],
      mostAnnotatedPages: [Number],
      
      comprehensionScore: Number, // 0-100
      engagementLevel: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      
      focusQuality: {
        type: String,
        enum: ['poor', 'fair', 'good', 'excellent']
      },
      
      difficultPages: [Number], // pages with high re-read rate
      
      readingConsistency: Number, // 0-100
      activeReadingIndicators: {
        highlightRate: Number, // highlights per page
        annotationRate: Number, // annotations per page
        selectionRate: Number // selections per page
      }
    }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for performance
pdfInteractionSchema.index({ sessionId: 1, roomId: 1 });
pdfInteractionSchema.index({ userId: 1, createdAt: -1 });

// Method to calculate reading patterns
pdfInteractionSchema.methods.calculateReadingPatterns = function() {
  const analytics = this.analytics;
  
  if (!analytics || !analytics.pageTimeSpent) {
    return null;
  }
  
  // Convert Map to array for calculations
  const pageTimeArray = Array.from(analytics.pageTimeSpent.entries());
  const pageVisitArray = Array.from(analytics.pagesVisited.entries());
  
  // Calculate total reading time
  const totalReadingTime = pageTimeArray.reduce((sum, [, time]) => sum + time, 0) / 1000; // convert to seconds
  
  // Calculate average time per page
  const avgTimePerPage = pageTimeArray.length > 0 
    ? totalReadingTime / pageTimeArray.length 
    : 0;
  
  // Calculate reading speed (pages per minute)
  const readingSpeed = totalReadingTime > 0 
    ? (pageTimeArray.length / totalReadingTime) * 60 
    : 0;
  
  // Most visited pages (top 5)
  const mostVisitedPages = pageVisitArray
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([page]) => parseInt(page));
  
  // Least visited pages
  const leastVisitedPages = pageVisitArray
    .sort(([, a], [, b]) => a - b)
    .slice(0, 5)
    .map(([page]) => parseInt(page));
  
  // Most highlighted pages
  const highlightsByPage = {};
  analytics.highlights?.forEach(h => {
    highlightsByPage[h.page] = (highlightsByPage[h.page] || 0) + 1;
  });
  const mostHighlightedPages = Object.entries(highlightsByPage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([page]) => parseInt(page));
  
  // Most annotated pages
  const annotationsByPage = {};
  analytics.annotations?.forEach(a => {
    annotationsByPage[a.page] = (annotationsByPage[a.page] || 0) + 1;
  });
  const mostAnnotatedPages = Object.entries(annotationsByPage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([page]) => parseInt(page));
  
  // Difficult pages (high revisit rate + long time)
  const difficultPages = pageVisitArray
    .filter(([page, visits]) => {
      const time = analytics.pageTimeSpent.get(page) || 0;
      return visits > 2 && time > avgTimePerPage * 1000 * 1.5;
    })
    .map(([page]) => parseInt(page));
  
  // Comprehension score (based on highlights, annotations, and time spent)
  const highlightScore = Math.min((analytics.highlights?.length || 0) / pageTimeArray.length * 20, 30);
  const annotationScore = Math.min((analytics.annotations?.length || 0) / pageTimeArray.length * 30, 40);
  const timeScore = Math.min(avgTimePerPage / 60 * 30, 30); // 2 min per page = full score
  const comprehensionScore = Math.round(highlightScore + annotationScore + timeScore);
  
  // Engagement level
  const engagementLevel = 
    comprehensionScore >= 70 ? 'high' :
    comprehensionScore >= 40 ? 'medium' : 'low';
  
  // Focus quality based on reading consistency
  const timeVariance = pageTimeArray.reduce((sum, [, time]) => {
    return sum + Math.pow(time - (avgTimePerPage * 1000), 2);
  }, 0) / pageTimeArray.length;
  const consistency = Math.max(0, 100 - (Math.sqrt(timeVariance) / 1000));
  
  const focusQuality = 
    consistency >= 75 ? 'excellent' :
    consistency >= 50 ? 'good' :
    consistency >= 25 ? 'fair' : 'poor';
  
  // Active reading indicators
  const activeReadingIndicators = {
    highlightRate: pageTimeArray.length > 0 ? (analytics.highlights?.length || 0) / pageTimeArray.length : 0,
    annotationRate: pageTimeArray.length > 0 ? (analytics.annotations?.length || 0) / pageTimeArray.length : 0,
    selectionRate: pageTimeArray.length > 0 ? (analytics.textSelections?.length || 0) / pageTimeArray.length : 0
  };
  
  return {
    avgTimePerPage: Math.round(avgTimePerPage),
    totalReadingTime: Math.round(totalReadingTime),
    readingSpeed: parseFloat(readingSpeed.toFixed(2)),
    mostVisitedPages,
    leastVisitedPages,
    mostHighlightedPages,
    mostAnnotatedPages,
    comprehensionScore,
    engagementLevel,
    focusQuality,
    difficultPages,
    readingConsistency: Math.round(consistency),
    activeReadingIndicators
  };
};

// Static method to get analytics for a session
pdfInteractionSchema.statics.getSessionAnalytics = async function(sessionId) {
  const interaction = await this.findOne({ sessionId });
  
  if (!interaction) {
    return null;
  }
  
  // Update reading patterns
  interaction.analytics.readingPatterns = interaction.calculateReadingPatterns();
  await interaction.save();
  
  return interaction.analytics;
};

// Static method to get teacher dashboard analytics
pdfInteractionSchema.statics.getTeacherAnalytics = async function(roomId) {
  const interactions = await this.find({ roomId }).populate('userId', 'name email');
  
  const studentAnalytics = interactions.map(interaction => {
    const patterns = interaction.calculateReadingPatterns();
    return {
      student: interaction.userId,
      sessionId: interaction.sessionId,
      patterns,
      highlights: interaction.analytics.highlights?.length || 0,
      annotations: interaction.analytics.annotations?.length || 0,
      lastUpdated: interaction.updatedAt
    };
  });
  
  // Aggregate class-wide insights
  const classInsights = {
    totalStudents: studentAnalytics.length,
    avgComprehensionScore: studentAnalytics.reduce((sum, s) => sum + (s.patterns?.comprehensionScore || 0), 0) / (studentAnalytics.length || 1),
    avgReadingSpeed: studentAnalytics.reduce((sum, s) => sum + (s.patterns?.readingSpeed || 0), 0) / (studentAnalytics.length || 1),
    
    engagementDistribution: {
      high: studentAnalytics.filter(s => s.patterns?.engagementLevel === 'high').length,
      medium: studentAnalytics.filter(s => s.patterns?.engagementLevel === 'medium').length,
      low: studentAnalytics.filter(s => s.patterns?.engagementLevel === 'low').length
    },
    
    strugglingStudents: studentAnalytics.filter(s => s.patterns?.comprehensionScore < 40),
    topPerformers: studentAnalytics.filter(s => s.patterns?.comprehensionScore >= 70)
  };
  
  return {
    studentAnalytics,
    classInsights
  };
};

module.exports = mongoose.model('PDFInteraction', pdfInteractionSchema);