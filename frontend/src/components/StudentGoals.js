import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './StudentGoals.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const StudentGoals = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [goals, setGoals] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newGoal, setNewGoal] = useState({
    subjects: [{ name: '', hours: 1, minutes: 0 }],
    period: 'weekly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    title: '',
    description: ''
  });

  const predefinedSubjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 
    'History', 'Geography', 'Computer Science', 'Economics', 'Psychology',
    'Philosophy', 'Literature', 'Statistics', 'Calculus', 'Algebra',
    'Business Studies', 'Accounting', 'Political Science', 'Sociology'
  ];

  useEffect(() => {
    fetchGoals();
  }, []);

  useEffect(() => {
    // Auto-calculate end date based on period
    if (newGoal.startDate && newGoal.period) {
      const start = new Date(newGoal.startDate);
      let end = new Date(start);
      
      switch (newGoal.period) {
        case 'daily':
          end = new Date(start);
          break;
        case 'weekly':
          end.setDate(start.getDate() + 6);
          break;
        case 'monthly':
          end.setMonth(start.getMonth() + 1);
          end.setDate(start.getDate() - 1);
          break;
        case 'custom':
          // Keep existing end date for custom
          return;
        default:
          break;
      }
      
      setNewGoal(prev => ({ 
        ...prev, 
        endDate: end.toISOString().split('T')[0] 
      }));
    }
  }, [newGoal.startDate, newGoal.period]);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/students/goals`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGoals(data);
      } else {
        setGoals(mockGoals);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
      setGoals(mockGoals);
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async () => {
    try {
      // Calculate total target minutes for all subjects
      const totalMinutes = newGoal.subjects.reduce((total, subject) => {
        return total + (subject.hours * 60) + subject.minutes;
      }, 0);

      const goalData = {
        ...newGoal,
        targetMinutes: totalMinutes,
        subjects: newGoal.subjects.filter(s => s.name.trim() !== '')
      };

      const response = await fetch(`${API_BASE_URL}/api/students/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(goalData)
      });
      
      if (response.ok) {
        const createdGoal = await response.json();
        setGoals([...goals, createdGoal]);
        setShowCreateGoal(false);
        resetNewGoal();
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      // Add to mock data for development
      const mockGoal = {
        id: Date.now().toString(),
        ...newGoal,
        targetMinutes: newGoal.subjects.reduce((total, subject) => {
          return total + (subject.hours * 60) + subject.minutes;
        }, 0),
        studiedMinutes: 0,
        status: 'active',
        progress: 0
      };
      setGoals([...goals, mockGoal]);
      setShowCreateGoal(false);
      resetNewGoal();
    }
  };

  const resetNewGoal = () => {
    setNewGoal({
      subjects: [{ name: '', hours: 1, minutes: 0 }],
      period: 'weekly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      title: '',
      description: ''
    });
  };

  const addSubject = () => {
    setNewGoal(prev => ({
      ...prev,
      subjects: [...prev.subjects, { name: '', hours: 1, minutes: 0 }]
    }));
  };

  const removeSubject = (index) => {
    setNewGoal(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }));
  };

  const updateSubject = (index, field, value) => {
    setNewGoal(prev => ({
      ...prev,
      subjects: prev.subjects.map((subject, i) => 
        i === index ? { ...subject, [field]: value } : subject
      )
    }));
  };

  const deleteGoal = async (goalId) => {
    try {
      await fetch(`${API_BASE_URL}/api/students/goals/${goalId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      setGoals(goals.filter(goal => goal.id !== goalId));
    } catch (error) {
      console.error('Error deleting goal:', error);
      setGoals(goals.filter(goal => goal.id !== goalId));
    }
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const getDaysRemaining = (endDate) => {
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getGoalStatus = (goal) => {
    const today = new Date();
    const endDate = new Date(goal.endDate);
    
    if (today > endDate) {
      return goal.progress >= 100 ? 'completed' : 'expired';
    }
    
    if (goal.progress >= 100) {
      return 'achieved';
    }
    
    return 'active';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'achieved': return '#22c55e';
      case 'active': return '#3b82f6';
      case 'expired': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getTotalPlannedTime = () => {
    return newGoal.subjects.reduce((total, subject) => {
      return total + (subject.hours * 60) + subject.minutes;
    }, 0);
  };

  // Mock data
  const mockGoals = [
    {
      id: '1',
      title: 'Midterm Preparation',
      subjects: [
        { name: 'Mathematics', hours: 2, minutes: 30 },
        { name: 'Physics', hours: 1, minutes: 45 },
        { name: 'Chemistry', hours: 1, minutes: 30 }
      ],
      targetMinutes: 345,
      period: 'weekly',
      startDate: '2024-01-15',
      endDate: '2024-01-21',
      description: 'Intensive study for midterm exams',
      studiedMinutes: 200,
      progress: 58
    }
  ];

  if (loading) {
    return (
      <div className="goals-full-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading your study goals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="goals-full-page">
      {/* Header with Navigation */}
      <header className="goals-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/student')}>
            ← Back to Dashboard
          </button>
          <div className="header-title">
            <h1>Study Goals & Planning</h1>
            <p>Plan your study schedule and track progress across subjects</p>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span>{user?.name}</span>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="goals-nav">
        <button 
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`nav-tab ${activeTab === 'active-goals' ? 'active' : ''}`}
          onClick={() => setActiveTab('active-goals')}
        >
          Active Goals ({goals.filter(g => getGoalStatus(g) === 'active').length})
        </button>
        <button 
          className={`nav-tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed
        </button>
        <button 
          className="create-goal-tab"
          onClick={() => setShowCreateGoal(true)}
        >
          + New Goal
        </button>
      </nav>

      {/* Main Content */}
      <main className="goals-main">
        {activeTab === 'overview' && (
          <div className="overview-content">
            {/* Statistics Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                  <div className="stat-number">{goals.length}</div>
                  <div className="stat-label">Total Goals</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🏃‍♂️</div>
                <div className="stat-content">
                  <div className="stat-number">
                    {goals.filter(g => getGoalStatus(g) === 'active').length}
                  </div>
                  <div className="stat-label">Active Goals</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <div className="stat-number">
                    {goals.filter(g => getGoalStatus(g) === 'completed' || getGoalStatus(g) === 'achieved').length}
                  </div>
                  <div className="stat-label">Completed</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                  <div className="stat-number">
                    {formatTime(goals.reduce((sum, g) => sum + g.studiedMinutes, 0))}
                  </div>
                  <div className="stat-label">Total Studied</div>
                </div>
              </div>
            </div>

            {/* Recent Goals Preview */}
            <div className="recent-goals-section">
              <div className="section-header">
                <h2>Recent Goals</h2>
                <button 
                  className="view-all-btn"
                  onClick={() => setActiveTab('active-goals')}
                >
                  View All
                </button>
              </div>
              <div className="goals-preview-grid">
                {goals.slice(0, 3).map(goal => (
                  <div key={goal.id} className="goal-preview-card">
                    <div className="goal-preview-header">
                      <h3>{goal.title || 'Study Goal'}</h3>
                      <span 
                        className="goal-status-badge"
                        style={{ backgroundColor: getStatusColor(getGoalStatus(goal)) }}
                      >
                        {getGoalStatus(goal)}
                      </span>
                    </div>
                    <div className="goal-preview-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{ 
                            width: `${Math.min(goal.progress, 100)}%`,
                            backgroundColor: getStatusColor(getGoalStatus(goal))
                          }}
                        ></div>
                      </div>
                      <span className="progress-text">{goal.progress}%</span>
                    </div>
                    <div className="goal-preview-details">
                      <span>{formatTime(goal.studiedMinutes)} / {formatTime(goal.targetMinutes)}</span>
                      <span>{getDaysRemaining(goal.endDate)} days left</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'active-goals' || activeTab === 'completed') && (
          <div className="goals-list-content">
            <div className="goals-grid">
              {goals
                .filter(goal => {
                  const status = getGoalStatus(goal);
                  return activeTab === 'active-goals' 
                    ? status === 'active' 
                    : status === 'completed' || status === 'achieved' || status === 'expired';
                })
                .map(goal => {
                  const status = getGoalStatus(goal);
                  return (
                    <div key={goal.id} className="goal-detail-card">
                      <div className="goal-card-header">
                        <div>
                          <h3>{goal.title || 'Study Goal'}</h3>
                          <span 
                            className="goal-status-badge"
                            style={{ backgroundColor: getStatusColor(status) }}
                          >
                            {status}
                          </span>
                        </div>
                        <button 
                          className="delete-goal-btn"
                          onClick={() => deleteGoal(goal.id)}
                          title="Delete goal"
                        >
                          🗑️
                        </button>
                      </div>

                      {/* Subjects Breakdown */}
                      <div className="subjects-section">
                        <h4>Subjects & Time Allocation</h4>
                        <div className="subjects-list">
                          {goal.subjects && goal.subjects.map((subject, index) => (
                            <div key={index} className="subject-item">
                              <span className="subject-name">{subject.name}</span>
                              <span className="subject-time">
                                {formatTime((subject.hours * 60) + subject.minutes)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="goal-progress-section">
                        <div className="progress-header">
                          <span>Overall Progress</span>
                          <span>{goal.progress}%</span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ 
                              width: `${Math.min(goal.progress, 100)}%`,
                              backgroundColor: getStatusColor(status)
                            }}
                          ></div>
                        </div>
                        <div className="progress-details">
                          <span>Studied: {formatTime(goal.studiedMinutes)}</span>
                          <span>Target: {formatTime(goal.targetMinutes)}</span>
                        </div>
                      </div>

                      <div className="goal-timeline">
                        <div className="timeline-item">
                          <span className="timeline-label">Period:</span>
                          <span>{goal.period}</span>
                        </div>
                        <div className="timeline-item">
                          <span className="timeline-label">Duration:</span>
                          <span>{new Date(goal.startDate).toLocaleDateString()} - {new Date(goal.endDate).toLocaleDateString()}</span>
                        </div>
                        <div className="timeline-item">
                          <span className="timeline-label">Days Left:</span>
                          <span>{getDaysRemaining(goal.endDate)}</span>
                        </div>
                      </div>

                      {goal.description && (
                        <div className="goal-description">
                          <p>{goal.description}</p>
                        </div>
                      )}

                      {status === 'active' && (
                        <div className="goal-actions">
                          <button 
                            className="start-session-btn"
                            onClick={() => navigate('/study-routine')}
                          >
                            Start Study Session
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              }
            </div>

            {goals.filter(goal => {
              const status = getGoalStatus(goal);
              return activeTab === 'active-goals' 
                ? status === 'active' 
                : status === 'completed' || status === 'achieved' || status === 'expired';
            }).length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">
                  {activeTab === 'active-goals' ? '🎯' : '✅'}
                </div>
                <h3>
                  {activeTab === 'active-goals' 
                    ? 'No Active Goals' 
                    : 'No Completed Goals Yet'
                  }
                </h3>
                <p>
                  {activeTab === 'active-goals' 
                    ? 'Create your first goal to start planning your study schedule!'
                    : 'Complete some goals to see them here.'
                  }
                </p>
                {activeTab === 'active-goals' && (
                  <button 
                    className="btn-primary"
                    onClick={() => setShowCreateGoal(true)}
                  >
                    Create Your First Goal
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create Goal Modal */}
      {showCreateGoal && (
        <div className="modal-overlay">
          <div className="create-goal-modal">
            <div className="modal-header">
              <h2>Create New Study Goal</h2>
              <button 
                className="close-btn"
                onClick={() => setShowCreateGoal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {/* Goal Title and Description */}
              <div className="form-section">
                <h3>Goal Details</h3>
                <div className="form-group">
                  <label>Goal Title</label>
                  <input 
                    type="text"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                    placeholder="e.g., Midterm Preparation, Weekly Study Plan"
                  />
                </div>
                <div className="form-group">
                  <label>Description (Optional)</label>
                  <textarea 
                    value={newGoal.description}
                    onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                    placeholder="What do you want to achieve with this goal?"
                    rows="2"
                  />
                </div>
              </div>

              {/* Subjects and Time Allocation */}
              <div className="form-section">
                <div className="section-header">
                  <h3>Subjects & Time Allocation</h3>
                  <button 
                    type="button"
                    className="add-subject-btn"
                    onClick={addSubject}
                  >
                    + Add Subject
                  </button>
                </div>
                
                <div className="subjects-form">
                  {newGoal.subjects.map((subject, index) => (
                    <div key={index} className="subject-form-row">
                      <div className="subject-select">
                        <label>Subject</label>
                        <select 
                          value={subject.name}
                          onChange={(e) => updateSubject(index, 'name', e.target.value)}
                        >
                          <option value="">Select Subject</option>
                          {predefinedSubjects.map(subj => (
                            <option key={subj} value={subj}>{subj}</option>
                          ))}
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      
                      <div className="time-inputs">
                        <label>Time Allocation</label>
                        <div className="time-input-group">
                          <input 
                            type="number"
                            value={subject.hours}
                            onChange={(e) => updateSubject(index, 'hours', parseInt(e.target.value) || 0)}
                            min="0"
                            max="23"
                          />
                          <span>hours</span>
                          <input 
                            type="number"
                            value={subject.minutes}
                            onChange={(e) => updateSubject(index, 'minutes', parseInt(e.target.value) || 0)}
                            min="0"
                            max="59"
                            step="15"
                          />
                          <span>minutes</span>
                        </div>
                      </div>
                      
                      {newGoal.subjects.length > 1 && (
                        <button 
                          type="button"
                          className="remove-subject-btn"
                          onClick={() => removeSubject(index)}
                          title="Remove subject"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="total-time-display">
                  <strong>Total Planned Time: {formatTime(getTotalPlannedTime())}</strong>
                </div>
              </div>

              {/* Time Period */}
              <div className="form-section">
                <h3>Time Period</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Period Type</label>
                    <select 
                      value={newGoal.period}
                      onChange={(e) => setNewGoal({...newGoal, period: e.target.value})}
                    >
                      <option value="daily">Daily Goal</option>
                      <option value="weekly">Weekly Goal</option>
                      <option value="monthly">Monthly Goal</option>
                      <option value="custom">Custom Period</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input 
                      type="date"
                      value={newGoal.startDate}
                      onChange={(e) => setNewGoal({...newGoal, startDate: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>End Date</label>
                    <input 
                      type="date"
                      value={newGoal.endDate}
                      onChange={(e) => setNewGoal({...newGoal, endDate: e.target.value})}
                      readOnly={newGoal.period !== 'custom'}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowCreateGoal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={createGoal}
                disabled={
                  !newGoal.title.trim() || 
                  newGoal.subjects.length === 0 || 
                  !newGoal.subjects.some(s => s.name.trim() !== '') ||
                  getTotalPlannedTime() === 0
                }
              >
                Create Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentGoals;