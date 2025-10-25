import React, { useState } from 'react';
import { Calendar, Target, Clock, TrendingUp, BookOpen, Award, Plus, Zap, CheckCircle, XCircle } from 'lucide-react';

// Add CSS animations
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default function StudyGoalsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [hoveredGoal, setHoveredGoal] = useState(null);
  const [goals, setGoals] = useState([
    {
      id: 1,
      title: 'Midterm Preparation',
      subjects: [{ subject: 'Mathematics', hoursPerDay: 2, color: '#3b82f6' }],
      status: 'expired',
      progress: 58,
      timeSpent: '3h 20m',
      timeTarget: '5h 45m',
      daysLeft: 0,
      priority: 'high',
      tasks: 12,
      tasksCompleted: 7,
      color: '#ef4444',
      targetDate: '2024-10-20',
      createdAt: new Date('2024-10-15')
    }
  ]);

  const [formData, setFormData] = useState({
    title: '',
    targetDate: '',
    priority: 'medium',
    subjects: []
  });

  const [currentSubject, setCurrentSubject] = useState({
    subject: '',
    hoursPerDay: '',
    customSubject: ''
  });

  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // Sample data
  const stats = {
    totalGoals: 1,
    activeGoals: 0,
    completed: 0,
    totalStudied: '3h 20m',
    streak: 5,
    weeklyTarget: 20,
    weeklyProgress: 12
  };

  const goals = [
    {
      id: 1,
      title: 'Midterm Preparation',
      subject: 'Mathematics',
      status: 'expired',
      progress: 58,
      timeSpent: '3h 20m',
      timeTarget: '5h 45m',
      daysLeft: 0,
      priority: 'high',
      tasks: 12,
      tasksCompleted: 7,
      color: '#ef4444'
    }
  ];

  const upcomingGoals = [
    { id: 2, title: 'Final Exam Prep', subject: 'Physics', dueIn: '5 days', progress: 0 },
    { id: 3, title: 'Assignment Completion', subject: 'Chemistry', dueIn: '2 days', progress: 25 }
  ];

  const subjects = [
    { name: 'Mathematics', hours: 12.5, color: '#3b82f6', trend: '+15%' },
    { name: 'Physics', hours: 8.3, color: '#8b5cf6', trend: '+8%' },
    { name: 'Chemistry', hours: 5.2, color: '#ec4899', trend: '-5%' }
  ];

  const getProgressColor = (progress) => {
    if (progress >= 75) return '#10b981';
    if (progress >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubjectInputChange = (e) => {
    setCurrentSubject({ ...currentSubject, [e.target.name]: e.target.value });
  };

  const addSubject = () => {
    if (!currentSubject.subject && !currentSubject.customSubject) {
      alert('Please select or enter a subject!');
      return;
    }
    if (!currentSubject.hoursPerDay || currentSubject.hoursPerDay <= 0) {
      alert('Please enter valid hours per day!');
      return;
    }

    const subjectName = currentSubject.subject === 'Custom' 
      ? currentSubject.customSubject 
      : currentSubject.subject;

    const newSubject = {
      subject: subjectName,
      hoursPerDay: parseFloat(currentSubject.hoursPerDay),
      color: getRandomColor()
    };

    setFormData({
      ...formData,
      subjects: [...formData.subjects, newSubject]
    });

    setCurrentSubject({ subject: '', hoursPerDay: '', customSubject: '' });
  };

  const removeSubject = (index) => {
    setFormData({
      ...formData,
      subjects: formData.subjects.filter((_, i) => i !== index)
    });
  };

  const getRandomColor = () => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (formData.subjects.length === 0) {
      alert('Please add at least one subject!');
      return;
    }

    console.log('New Goal:', formData);
    // TODO: Send to backend API
    setShowNewGoalModal(false);
    setFormData({ title: '', targetDate: '', priority: 'medium', subjects: [] });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative'
    }}>
      {/* New Goal Modal */}
      {showNewGoalModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.3s'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '40px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            animation: 'slideUp 0.3s'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#1f2937' }}>
                🎯 Create New Goal
              </h2>
              <button
                onClick={() => setShowNewGoalModal(false)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  color: '#6b7280',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#e5e7eb'}
                onMouseLeave={(e) => e.target.style.background = '#f3f4f6'}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Goal Title */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Goal Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Midterm Preparation 2024"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Target Date */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Target Date *
                </label>
                <input
                  type="date"
                  name="targetDate"
                  value={formData.targetDate}
                  onChange={handleInputChange}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Add Subjects Section */}
              <div style={{
                background: '#f9fafb',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px',
                border: '2px dashed #e5e7eb'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600', color: '#374151' }}>
                  📚 Add Subjects
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  {/* Subject Selection */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                      Subject
                    </label>
                    <select
                      name="subject"
                      value={currentSubject.subject}
                      onChange={handleSubjectInputChange}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '0.95rem',
                        outline: 'none',
                        background: 'white'
                      }}
                    >
                      <option value="">Select subject...</option>
                      <option value="Mathematics">📐 Mathematics</option>
                      <option value="Physics">⚛️ Physics</option>
                      <option value="Chemistry">🧪 Chemistry</option>
                      <option value="Biology">🧬 Biology</option>
                      <option value="Computer Science">💻 Computer Science</option>
                      <option value="English">📖 English</option>
                      <option value="History">📜 History</option>
                      <option value="Economics">💰 Economics</option>
                      <option value="Geography">🌍 Geography</option>
                      <option value="Custom">✏️ Custom (Enter below)</option>
                    </select>
                  </div>

                  {/* Hours Per Day */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                      Hours/Day
                    </label>
                    <input
                      type="number"
                      name="hoursPerDay"
                      value={currentSubject.hoursPerDay}
                      onChange={handleSubjectInputChange}
                      placeholder="e.g., 2"
                      min="0.5"
                      max="12"
                      step="0.5"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '0.95rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Custom Subject Input */}
                {currentSubject.subject === 'Custom' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                      Enter Subject Name
                    </label>
                    <input
                      type="text"
                      name="customSubject"
                      value={currentSubject.customSubject}
                      onChange={handleSubjectInputChange}
                      placeholder="e.g., Music Theory, Art History..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '0.95rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}

                {/* Add Subject Button */}
                <button
                  type="button"
                  onClick={addSubject}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                  + Add Subject
                </button>

                {/* Added Subjects List */}
                {formData.subjects.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
                      Added Subjects ({formData.subjects.length})
                    </div>
                    {formData.subjects.map((subj, index) => (
                      <div
                        key={index}
                        style={{
                          background: 'white',
                          padding: '12px',
                          borderRadius: '10px',
                          marginBottom: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: `2px solid ${subj.color}20`,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: subj.color
                          }} />
                          <div>
                            <div style={{ fontWeight: '600', color: '#1f2937' }}>
                              {subj.subject}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                              {subj.hoursPerDay} hours/day
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSubject(index)}
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#fecaca'}
                          onMouseLeave={(e) => e.target.style.background = '#fee2e2'}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div style={{
                      marginTop: '12px',
                      padding: '10px',
                      background: '#eff6ff',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      color: '#1e40af',
                      fontWeight: '600'
                    }}>
                      📊 Total: {formData.subjects.reduce((sum, s) => sum + s.hoursPerDay, 0)} hours/day
                    </div>
                  </div>
                )}
              </div>

              {/* Priority */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                  Priority Level
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[
                    { value: 'low', label: 'Low', color: '#10b981', emoji: '🟢' },
                    { value: 'medium', label: 'Medium', color: '#f59e0b', emoji: '🟡' },
                    { value: 'high', label: 'High', color: '#ef4444', emoji: '🔴' }
                  ].map(priority => (
                    <button
                      key={priority.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, priority: priority.value })}
                      style={{
                        flex: 1,
                        padding: '12px',
                        border: `2px solid ${formData.priority === priority.value ? priority.color : '#e5e7eb'}`,
                        background: formData.priority === priority.value ? `${priority.color}15` : 'white',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.95rem',
                        transition: 'all 0.2s',
                        color: formData.priority === priority.value ? priority.color : '#6b7280'
                      }}
                    >
                      {priority.emoji} {priority.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewGoalModal(false);
                    setFormData({ title: '', targetDate: '', priority: 'medium', subjects: [] });
                    setCurrentSubject({ subject: '', hoursPerDay: '', customSubject: '' });
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    border: '2px solid #e5e7eb',
                    background: 'white',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem',
                    color: '#6b7280',
                    transition: 'all 0.2s'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem',
                    color: 'white',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  🚀 Create Goal ({formData.subjects.length} subject{formData.subjects.length !== 1 ? 's' : ''})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', color: '#1f2937', fontWeight: '700' }}>
              🎯 Study Goals & Planning
            </h1>
            <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '1rem' }}>
              Plan your study schedule and crush your targets
            </p>
          </div>
          <button
            onClick={() => setShowNewGoalModal(true)}
            style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              border: 'none',
              padding: '14px 28px',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <Plus size={20} /> New Goal
          </button>
        </div>
      </div>

      {/* Stats Cards - Animated */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {[
          { icon: Target, label: 'Total Goals', value: stats.totalGoals, color: '#3b82f6', trend: null },
          { icon: Zap, label: 'Active Goals', value: stats.activeGoals, color: '#f59e0b', trend: null },
          { icon: CheckCircle, label: 'Completed', value: stats.completed, color: '#10b981', trend: null },
          { icon: Clock, label: 'Total Studied', value: stats.totalStudied, color: '#8b5cf6', trend: '+12%' },
          { icon: Award, label: 'Study Streak', value: `${stats.streak} days`, color: '#ec4899', trend: '🔥' }
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                transition: 'all 0.3s',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.08)';
              }}
            >
              <div style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: stat.color,
                opacity: 0.1
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{
                    background: `${stat.color}15`,
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px'
                  }}>
                    <Icon size={24} color={stat.color} />
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1f2937' }}>
                    {stat.value}
                  </div>
                </div>
                {stat.trend && (
                  <div style={{
                    background: stat.trend.includes('%') ? '#dcfce7' : '#fef3c7',
                    color: stat.trend.includes('%') ? '#16a34a' : '#f59e0b',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {stat.trend}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Progress Ring */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: '600' }}>
          📊 Weekly Study Target
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {/* Circular Progress */}
          <div style={{ position: 'relative', width: 140, height: 140 }}>
            <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="70" cy="70" r="60" fill="none" stroke="#f3f4f6" strokeWidth="12" />
              <circle
                cx="70" cy="70" r="60" fill="none"
                stroke="url(#gradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 60}`}
                strokeDashoffset={`${2 * Math.PI * 60 * (1 - stats.weeklyProgress / stats.weeklyTarget)}`}
                style={{ transition: 'stroke-dashoffset 1s' }}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#667eea' }}>
                {Math.round((stats.weeklyProgress / stats.weeklyTarget) * 100)}%
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>complete</div>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#6b7280' }}>Progress</span>
              <span style={{ fontWeight: '600' }}>{stats.weeklyProgress}h / {stats.weeklyTarget}h</span>
            </div>
            <div style={{
              background: '#f3f4f6',
              height: 12,
              borderRadius: 20,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(stats.weeklyProgress / stats.weeklyTarget) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #667eea, #764ba2)',
                borderRadius: 20,
                transition: 'width 1s'
              }} />
            </div>
            <p style={{ marginTop: '12px', fontSize: '0.875rem', color: '#6b7280' }}>
              Keep going! You need <strong>{stats.weeklyTarget - stats.weeklyProgress} more hours</strong> to reach your weekly target 💪
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '8px',
        marginBottom: '24px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
        display: 'flex',
        gap: '8px'
      }}>
        {['overview', 'active', 'completed', 'subjects'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '12px 20px',
              border: 'none',
              background: activeTab === tab ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
              color: activeTab === tab ? 'white' : '#6b7280',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.95rem',
              transition: 'all 0.3s',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Goals Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '20px'
      }}>
        {goals.map(goal => (
          <div
            key={goal.id}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: hoveredGoal === goal.id ? '0 12px 40px rgba(0,0,0,0.15)' : '0 4px 15px rgba(0,0,0,0.08)',
              transition: 'all 0.3s',
              cursor: 'pointer',
              border: `2px solid ${hoveredGoal === goal.id ? goal.color : 'transparent'}`,
              transform: hoveredGoal === goal.id ? 'translateY(-5px)' : 'translateY(0)'
            }}
            onMouseEnter={() => setHoveredGoal(goal.id)}
            onMouseLeave={() => setHoveredGoal(null)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                  {goal.title}
                </h3>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                  <span style={{
                    background: `${goal.color}15`,
                    color: goal.color,
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {goal.subject}
                  </span>
                  <span style={{
                    background: goal.status === 'expired' ? '#fee2e2' : '#dcfce7',
                    color: goal.status === 'expired' ? '#dc2626' : '#16a34a',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    {goal.status === 'expired' ? '⏰ Expired' : '✓ Active'}
                  </span>
                </div>
              </div>
              <div style={{
                background: `${goal.color}15`,
                color: goal.color,
                width: 48,
                height: 48,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: '700'
              }}>
                {goal.progress}%
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                background: '#f3f4f6',
                height: 10,
                borderRadius: 20,
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${goal.progress}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${goal.color}, ${goal.color}dd)`,
                  borderRadius: 20,
                  transition: 'width 1s'
                }} />
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>Time Progress</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937' }}>
                  {goal.timeSpent} / {goal.timeTarget}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>Tasks</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937' }}>
                  {goal.tasksCompleted} / {goal.tasks} completed
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.3s'
            }}>
              📊 View Detailed Insights
            </button>
          </div>
        ))}

        {/* Upcoming Goals */}
        {upcomingGoals.map(goal => (
          <div
            key={goal.id}
            style={{
              background: 'linear-gradient(135deg, #fef3c7, #fed7aa)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
              border: '2px dashed #f59e0b'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: '700' }}>
              {goal.title}
            </h4>
            <p style={{ margin: '0 0 16px 0', color: '#92400e', fontSize: '0.9rem' }}>
              {goal.subject} • Due in {goal.dueIn}
            </p>
            <button style={{
              width: '100%',
              padding: '10px',
              background: 'white',
              color: '#f59e0b',
              border: '2px solid #f59e0b',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.3s'
            }}>
              Start Working →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}