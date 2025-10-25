import React, { useState } from 'react';
import { Calendar, Target, Clock, TrendingUp, BookOpen, Award, Plus, Zap, CheckCircle, XCircle } from 'lucide-react';

export default function StudyGoalsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [hoveredGoal, setHoveredGoal] = useState(null);

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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
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