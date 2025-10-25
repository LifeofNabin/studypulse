// frontend/src/components/StudentGoals.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Target, Clock, TrendingUp, BookOpen, Award, Plus, Zap, CheckCircle, XCircle } from 'lucide-react';
import DOMPurify from 'dompurify';

// ==================== CONSTANTS ====================
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#10b981', emoji: '🟢' },
  { value: 'medium', label: 'Medium', color: '#f59e0b', emoji: '🟡' },
  { value: 'high', label: 'High', color: '#ef4444', emoji: '🔴' }
];

const SUBJECT_OPTIONS = [
  { value: 'Mathematics', label: '📐 Mathematics' },
  { value: 'Physics', label: '⚛️ Physics' },
  { value: 'Chemistry', label: '🧪 Chemistry' },
  { value: 'Biology', label: '🧬 Biology' },
  { value: 'Computer Science', label: '💻 Computer Science' },
  { value: 'English', label: '📖 English' },
  { value: 'History', label: '📜 History' },
  { value: 'Economics', label: '💰 Economics' },
  { value: 'Geography', label: '🌍 Geography' },
  { value: 'Custom', label: '✏️ Custom (Enter below)' }
];

const SUBJECT_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', 
  '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'
];

// ==================== UTILITIES ====================
const sanitizeInput = (input) => {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

const getAuthToken = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return token;
};

const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const calculateDaysLeft = (targetDate) => {
  return Math.ceil((new Date(targetDate) - new Date()) / (1000 * 60 * 60 * 24));
};

const getRandomColor = () => {
  return SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)];
};

// ==================== CUSTOM HOOKS ====================
const useGoals = (apiBaseUrl) => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/api/goals`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch goals`);
      }

      const data = await response.json();
      setGoals(data);
    } catch (err) {
      console.error('Error fetching goals:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const createGoal = useCallback(async (goalData) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(goalData)
      });

      if (!response.ok) {
        throw new Error('Failed to create goal');
      }

      const savedGoal = await response.json();
      setGoals(prev => [...prev, savedGoal]);
      return { success: true, goal: savedGoal };
    } catch (err) {
      console.error('Error creating goal:', err);
      return { success: false, error: err.message };
    }
  }, [apiBaseUrl]);

  const deleteGoal = useCallback(async (goalId) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/goals/${goalId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete goal');
      }

      setGoals(prev => prev.filter(g => g.id !== goalId));
      return { success: true };
    } catch (err) {
      console.error('Error deleting goal:', err);
      return { success: false, error: err.message };
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return { goals, loading, error, createGoal, deleteGoal, refetch: fetchGoals };
};

// ==================== SUB-COMPONENTS ====================
const GoalCard = React.memo(({ goal, onStart, onDelete, onViewReport }) => {
  const [isHovered, setIsHovered] = useState(false);

  const daysLeft = useMemo(() => calculateDaysLeft(goal.target_date), [goal.target_date]);
  const isExpired = daysLeft < 0;
  const status = isExpired ? 'expired' : goal.status;
  const progress = goal.progress || 0;
  const timeSpent = formatTime(goal.total_time_spent || 0);
  const timeTarget = `${goal.target_hours}h`;

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: isHovered ? '0 12px 40px rgba(0,0,0,0.15)' : '0 4px 15px rgba(0,0,0,0.08)',
        transition: 'all 0.3s',
        cursor: 'pointer',
        border: `2px solid ${isHovered ? (goal.subjects[0]?.color || '#667eea') : 'transparent'}`,
        transform: isHovered ? 'translateY(-5px)' : 'translateY(0)',
        position: 'relative'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(goal.id);
        }}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: '#fee2e2',
          color: '#dc2626',
          border: 'none',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '1.2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          opacity: isHovered ? 1 : 0
        }}
        onMouseEnter={(e) => e.target.style.background = '#fecaca'}
        onMouseLeave={(e) => e.target.style.background = '#fee2e2'}
        title="Delete goal"
        aria-label="Delete goal"
      >
        🗑️
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
            {sanitizeInput(goal.title)}
          </h3>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {goal.subjects.map((subj, idx) => (
              <span key={idx} style={{
                background: `${subj.color}15`,
                color: subj.color,
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                {sanitizeInput(subj.subject)}
              </span>
            ))}
            <span style={{
              background: status === 'expired' ? '#fee2e2' : status === 'completed' ? '#dcfce7' : '#e0e7ff',
              color: status === 'expired' ? '#dc2626' : status === 'completed' ? '#16a34a' : '#4f46e5',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '600',
              textTransform: 'uppercase'
            }}>
              {status === 'expired' ? '⏰ Expired' : status === 'completed' ? '✓ Complete' : '✓ Active'}
            </span>
          </div>
        </div>
        <div style={{
          background: `${goal.subjects[0]?.color || '#667eea'}15`,
          color: goal.subjects[0]?.color || '#667eea',
          width: 48,
          height: 48,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          fontWeight: '700'
        }}>
          {Math.round(progress)}%
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
            width: `${Math.min(progress, 100)}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${goal.subjects[0]?.color || '#667eea'}, ${goal.subjects[0]?.color || '#667eea'}dd)`,
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
            {timeSpent} / {timeTarget}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>Days Left</div>
          <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1f2937' }}>
            {daysLeft > 0 ? `${daysLeft} days` : 'Expired'}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <button 
        onClick={() => onStart(goal)}
        style={{
          width: '100%',
          padding: '12px',
          background: status === 'expired' 
            ? 'linear-gradient(135deg, #6b7280, #4b5563)' 
            : 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          fontWeight: '600',
          transition: 'all 0.3s',
          marginBottom: progress > 0 ? '8px' : '0'
        }}
      >
        {status === 'expired' ? '🔄 Continue Anyway' : '▶️ Start Session'}
      </button>
      
      {progress > 0 && (
        <button 
          onClick={() => onViewReport(goal)}
          style={{
            width: '100%',
            padding: '12px',
            background: 'white',
            color: '#667eea',
            border: '2px solid #667eea',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s'
          }}
        >
          📊 View Progress Report
        </button>
      )}
    </div>
  );
});

const StatCard = React.memo(({ icon: Icon, label, value, color, trend }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: isHovered ? '0 8px 30px rgba(0,0,0,0.15)' : '0 4px 15px rgba(0,0,0,0.08)',
        transition: 'all 0.3s',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transform: isHovered ? 'translateY(-5px)' : 'translateY(0)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: color,
        opacity: 0.1
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            background: `${color}15`,
            width: 48,
            height: 48,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <Icon size={24} color={color} />
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
            {label}
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1f2937' }}>
            {value}
          </div>
        </div>
        {trend && (
          <div style={{
            background: trend.includes('%') ? '#dcfce7' : '#fef3c7',
            color: trend.includes('%') ? '#16a34a' : '#f59e0b',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            {trend}
          </div>
        )}
      </div>
    </div>
  );
});

const NewGoalModal = ({ isOpen, onClose, onSubmit }) => {
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

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: sanitizeInput(value) }));
  };

  const handleSubjectInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentSubject(prev => ({ ...prev, [name]: value }));
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
      ? sanitizeInput(currentSubject.customSubject)
      : currentSubject.subject;

    const newSubject = {
      subject: subjectName,
      hoursPerDay: parseFloat(currentSubject.hoursPerDay),
      color: getRandomColor()
    };

    setFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, newSubject]
    }));

    setCurrentSubject({ subject: '', hoursPerDay: '', customSubject: '' });
  };

  const removeSubject = (index) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (formData.subjects.length === 0) {
      alert('Please add at least one subject!');
      return;
    }

    const totalHoursPerDay = formData.subjects.reduce((sum, s) => sum + s.hoursPerDay, 0);
    const daysUntilTarget = Math.ceil((new Date(formData.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
    const totalTargetHours = totalHoursPerDay * daysUntilTarget;

    const goalData = {
      title: formData.title,
      subjects: formData.subjects,
      status: 'active',
      progress: 0,
      target_hours: totalTargetHours,
      hours_per_day: totalHoursPerDay,
      days_left: daysUntilTarget,
      priority: formData.priority,
      target_date: formData.targetDate,
      created_at: new Date().toISOString()
    };

    onSubmit(goalData);
    
    // Reset form
    setFormData({ title: '', targetDate: '', priority: 'medium', subjects: [] });
    setCurrentSubject({ subject: '', hoursPerDay: '', customSubject: '' });
  };

  return (
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
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '40px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#1f2937' }}>
            🎯 Create New Goal
          </h2>
          <button
            onClick={onClose}
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
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Goal Title */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="goal-title" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
              Goal Title *
            </label>
            <input
              id="goal-title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Midterm Preparation 2024"
              required
              maxLength={100}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '1rem',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            />
          </div>

          {/* Target Date */}
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="target-date" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
              Target Date *
            </label>
            <input
              id="target-date"
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
              <div>
                <label htmlFor="subject-select" style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                  Subject
                </label>
                <select
                  id="subject-select"
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
                  {SUBJECT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="hours-per-day" style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                  Hours/Day
                </label>
                <input
                  id="hours-per-day"
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

            {currentSubject.subject === 'Custom' && (
              <div style={{ marginBottom: '12px' }}>
                <label htmlFor="custom-subject" style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                  Enter Subject Name
                </label>
                <input
                  id="custom-subject"
                  type="text"
                  name="customSubject"
                  value={currentSubject.customSubject}
                  onChange={handleSubjectInputChange}
                  placeholder="e.g., Music Theory, Art History..."
                  maxLength={50}
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
            >
              + Add Subject
            </button>

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
                      aria-label={`Remove ${subj.subject}`}
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
              {PRIORITY_OPTIONS.map(priority => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: priority.value }))}
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
              onClick={onClose}
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
            >
              🚀 Create Goal ({formData.subjects.length} subject{formData.subjects.length !== 1 ? 's' : ''})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export default function StudyGoalsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

  const { goals, loading, error, createGoal, deleteGoal } = useGoals(API_BASE_URL);

  // Calculate stats
  const stats = useMemo(() => ({
    totalGoals: goals.length,
    activeGoals: goals.filter(g => g.status === 'active').length,
    completed: goals.filter(g => g.status === 'completed').length,
    totalStudied: goals.reduce((sum, g) => sum + (g.total_time_spent || 0), 0),
    streak: 5,
    weeklyTarget: 20,
    weeklyProgress: 12
  }), [goals]);

  const handleCreateGoal = async (goalData) => {
    const result = await createGoal(goalData);
    if (result.success) {
      setShowNewGoalModal(false);
      // Optional: Show success toast
    } else {
      alert('Failed to create goal. Please try again.');
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) {
      return;
    }

    const result = await deleteGoal(goalId);
    if (!result.success) {
      alert('Failed to delete goal. Please try again.');
    }
  };

  const handleStartSession = async (goal) => {
    try {
      localStorage.setItem('activeGoal', JSON.stringify(goal));
      
      const response = await fetch(`${API_BASE_URL}/api/sessions/create-from-goal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          goalId: goal.id,
          goalTitle: goal.title,
          subjects: goal.subjects
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      const sessionData = await response.json();
      window.location.href = `/student/study-session/${sessionData.session_id}`;
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session. Please try again.');
    }
  };

  const handleViewReport = (goal) => {
    setSelectedReport(goal);
    setShowReportModal(true);
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
      <NewGoalModal
        isOpen={showNewGoalModal}
        onClose={() => setShowNewGoalModal(false)}
        onSubmit={handleCreateGoal}
      />

      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
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

      {/* Error Message */}
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '2px solid #fecaca',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <XCircle size={24} color="#dc2626" />
          <div>
            <div style={{ fontWeight: '600', color: '#dc2626', marginBottom: '4px' }}>
              Error Loading Goals
            </div>
            <div style={{ color: '#991b1b', fontSize: '0.9rem' }}>
              {error}
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <StatCard icon={Target} label="Total Goals" value={stats.totalGoals} color="#3b82f6" />
        <StatCard icon={Zap} label="Active Goals" value={stats.activeGoals} color="#f59e0b" />
        <StatCard icon={CheckCircle} label="Completed" value={stats.completed} color="#10b981" />
        <StatCard icon={Clock} label="Total Studied" value={formatTime(stats.totalStudied)} color="#8b5cf6" trend="+12%" />
        <StatCard icon={Award} label="Study Streak" value={`${stats.streak} days`} color="#ec4899" trend="🔥" />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
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

          <div style={{ flex: 1, minWidth: '250px' }}>
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
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {['overview', 'active', 'completed', 'subjects'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              minWidth: '100px',
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
        {loading ? (
          <div style={{ 
            gridColumn: '1 / -1', 
            textAlign: 'center', 
            padding: '60px',
            color: 'white',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>Loading your goals...</div>
          </div>
        ) : goals.length === 0 ? (
          <div style={{ 
            gridColumn: '1 / -1', 
            background: 'white',
            borderRadius: '20px',
            padding: '60px',
            textAlign: 'center',
            boxShadow: '0 4px 15px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎯</div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', color: '#1f2937' }}>
              No Goals Yet
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '1rem' }}>
              Create your first study goal to start tracking your progress!
            </p>
            <button
              onClick={() => setShowNewGoalModal(true)}
              style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              + Create Your First Goal
            </button>
          </div>
        ) : (
          goals
            .filter(goal => {
              if (activeTab === 'overview') return true;
              if (activeTab === 'active') return goal.status === 'active';
              if (activeTab === 'completed') return goal.status === 'completed';
              return true;
            })
            .map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onStart={handleStartSession}
                onDelete={handleDeleteGoal}
                onViewReport={handleViewReport}
              />
            ))
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && selectedReport && (
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
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '40px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#1f2937' }}>
                📊 Progress Report
              </h2>
              <button
                onClick={() => setShowReportModal(false)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  color: '#6b7280'
                }}
                aria-label="Close report"
              >
                ✕
              </button>
            </div>
            <div style={{ color: '#6b7280' }}>
              <h3 style={{ color: '#1f2937', marginBottom: '12px' }}>
                {sanitizeInput(selectedReport.title)}
              </h3>
              <p>Detailed progress report coming soon...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}