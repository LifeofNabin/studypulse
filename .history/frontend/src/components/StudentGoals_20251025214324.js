import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Lightbulb, Code, Zap } from 'lucide-react';

export default function CodeReview() {
  const [activeSection, setActiveSection] = useState('issues');

  const criticalIssues = [
    {
      severity: 'critical',
      title: 'Duplicate Goal Rendering',
      description: 'Goals are rendered twice in different grid containers, causing confusion and performance issues',
      location: 'Lines 850-950',
      solution: 'Remove the duplicate grid section and consolidate into a single rendering block'
    },
    {
      severity: 'critical',
      title: 'Missing Error Handling',
      description: 'API calls lack comprehensive error handling and user feedback',
      location: 'fetchGoals(), handleSubmit(), handleDeleteGoal()',
      solution: 'Add try-catch blocks with user-friendly error messages and loading states'
    },
    {
      severity: 'high',
      title: 'localStorage Token Management',
      description: 'Direct localStorage access for auth tokens without validation or expiry checks',
      location: 'Multiple locations',
      solution: 'Create a secure token management utility with validation and auto-refresh'
    },
    {
      severity: 'high',
      title: 'Memory Leak Risk',
      description: 'Style injection in component body runs on every render',
      location: 'Lines 8-24',
      solution: 'Move style injection outside component or use a CSS-in-JS solution'
    }
  ];

  const improvements = [
    {
      category: 'State Management',
      items: [
        'Consider using useReducer for complex form state',
        'Implement optimistic UI updates for better UX',
        'Add loading states for all async operations',
        'Use React Query or SWR for data fetching and caching'
      ]
    },
    {
      category: 'Performance',
      items: [
        'Memoize expensive calculations (progress percentages, time formatting)',
        'Use React.memo for goal card components',
        'Implement virtual scrolling for large goal lists',
        'Debounce API calls and form inputs'
      ]
    },
    {
      category: 'Code Organization',
      items: [
        'Extract GoalCard as a separate component',
        'Create custom hooks (useGoals, useAuth)',
        'Move API calls to a separate service layer',
        'Create a constants file for colors and options'
      ]
    },
    {
      category: 'User Experience',
      items: [
        'Add confirmation dialogs for destructive actions',
        'Implement toast notifications for success/error states',
        'Add keyboard shortcuts for common actions',
        'Include empty state illustrations'
      ]
    }
  ];

  const securityConcerns = [
    {
      issue: 'XSS Vulnerability',
      description: 'User input (goal titles, custom subjects) rendered without sanitization',
      fix: 'Use DOMPurify or implement input validation/sanitization'
    },
    {
      issue: 'Token Exposure',
      description: 'Auth tokens stored in localStorage are vulnerable to XSS attacks',
      fix: 'Consider httpOnly cookies or secure session management'
    },
    {
      issue: 'Missing CSRF Protection',
      description: 'No CSRF tokens in API requests',
      fix: 'Implement CSRF token validation for state-changing operations'
    }
  ];

  const bestPractices = [
    {
      title: 'TypeScript Migration',
      description: 'Convert to TypeScript for type safety',
      benefit: 'Catch errors at compile time, better IDE support'
    },
    {
      title: 'Accessibility',
      description: 'Add ARIA labels, keyboard navigation, focus management',
      benefit: 'Make the app usable for all users'
    },
    {
      title: 'Testing',
      description: 'Add unit tests for components and integration tests for API calls',
      benefit: 'Ensure reliability and catch regressions early'
    },
    {
      title: 'Error Boundaries',
      description: 'Wrap component in error boundary to catch runtime errors',
      benefit: 'Graceful error handling and better user experience'
    }
  ];

  const codeSnippets = {
    errorHandling: `// Improved error handling
const fetchGoals = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const response = await fetch(\`\${API_BASE_URL}/api/goals\`, {
      headers: {
        'Authorization': \`Bearer \${getAuthToken()}\`
      }
    });

    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    const data = await response.json();
    setGoals(data);
  } catch (error) {
    console.error('Error fetching goals:', error);
    setError('Failed to load goals. Please try again.');
    showToast('error', 'Could not load your goals');
  } finally {
    setLoading(false);
  }
};`,
    customHook: `// Custom hook for goals management
function useGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGoals = useCallback(async () => {
    // ... fetch logic
  }, []);

  const createGoal = useCallback(async (goalData) => {
    // ... create logic with optimistic update
  }, []);

  const deleteGoal = useCallback(async (goalId) => {
    // ... delete logic with optimistic update
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return { goals, loading, error, createGoal, deleteGoal, refetch: fetchGoals };
}`,
    componentExtraction: `// Extracted GoalCard component
const GoalCard = React.memo(({ goal, onStart, onDelete, onViewReport }) => {
  const [isHovered, setIsHovered] = useState(false);
  const daysLeft = calculateDaysLeft(goal.target_date);
  const progress = calculateProgress(goal);

  return (
    <div
      className="goal-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card content */}
    </div>
  );
});`
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '32px',
          marginBottom: '24px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', color: '#1f2937', fontWeight: '700' }}>
            📋 Code Review: StudentGoals Component
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>
            Comprehensive analysis with actionable improvements
          </p>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '8px',
          marginBottom: '24px',
          display: 'flex',
          gap: '8px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.08)'
        }}>
          {[
            { id: 'issues', label: '🐛 Issues', count: criticalIssues.length },
            { id: 'improvements', label: '⚡ Improvements', count: improvements.length },
            { id: 'security', label: '🔒 Security', count: securityConcerns.length },
            { id: 'practices', label: '✨ Best Practices', count: bestPractices.length },
            { id: 'code', label: '💻 Code Examples', count: 3 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                background: activeSection === tab.id ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
                color: activeSection === tab.id ? 'white' : '#6b7280',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem',
                transition: 'all 0.3s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>{tab.label}</span>
              {tab.count && (
                <span style={{
                  fontSize: '0.75rem',
                  opacity: 0.8
                }}>
                  ({tab.count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Sections */}
        {activeSection === 'issues' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {criticalIssues.map((issue, idx) => (
              <div
                key={idx}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                  borderLeft: `4px solid ${
                    issue.severity === 'critical' ? '#ef4444' :
                    issue.severity === 'high' ? '#f59e0b' : '#3b82f6'
                  }`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: '16px' }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    background: issue.severity === 'critical' ? '#fee2e2' : '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {issue.severity === 'critical' ? <XCircle size={24} color="#ef4444" /> : <AlertTriangle size={24} color="#f59e0b" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#1f2937' }}>
                        {issue.title}
                      </h3>
                      <span style={{
                        background: issue.severity === 'critical' ? '#fee2e2' : '#fef3c7',
                        color: issue.severity === 'critical' ? '#dc2626' : '#d97706',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        {issue.severity}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: '0.95rem' }}>
                      {issue.description}
                    </p>
                    <div style={{
                      background: '#f9fafb',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>
                        📍 Location:
                      </div>
                      <code style={{ fontSize: '0.9rem', color: '#667eea', fontWeight: '600' }}>
                        {issue.location}
                      </code>
                    </div>
                    <div style={{
                      background: '#ecfdf5',
                      padding: '12px',
                      borderRadius: '8px',
                      borderLeft: '3px solid #10b981'
                    }}>
                      <div style={{ fontSize: '0.85rem', color: '#047857', fontWeight: '600', marginBottom: '4px' }}>
                        ✅ Solution:
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#065f46' }}>
                        {issue.solution}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'improvements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {improvements.map((category, idx) => (
              <div
                key={idx}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)'
                }}
              >
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Zap size={24} color="#667eea" />
                  {category.category}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {category.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'start',
                        gap: '12px',
                        padding: '12px',
                        background: '#f9fafb',
                        borderRadius: '10px'
                      }}
                    >
                      <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ color: '#374151', fontSize: '0.95rem' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {securityConcerns.map((concern, idx) => (
              <div
                key={idx}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                  borderLeft: '4px solid #ef4444'
                }}
              >
                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '700', color: '#dc2626' }}>
                  🔒 {concern.issue}
                </h3>
                <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '0.95rem' }}>
                  {concern.description}
                </p>
                <div style={{
                  background: '#fef2f2',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #fecaca'
                }}>
                  <div style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: '600', marginBottom: '8px' }}>
                    🛡️ Recommended Fix:
                  </div>
                  <div style={{ fontSize: '0.95rem', color: '#991b1b' }}>
                    {concern.fix}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'practices' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {bestPractices.map((practice, idx) => (
              <div
                key={idx}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <Lightbulb size={24} color="white" />
                </div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '700', color: '#1f2937' }}>
                  {practice.title}
                </h3>
                <p style={{ margin: '0 0 12px 0', color: '#6b7280', fontSize: '0.9rem' }}>
                  {practice.description}
                </p>
                <div style={{
                  padding: '12px',
                  background: '#eff6ff',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  color: '#1e40af'
                }}>
                  <strong>Benefit:</strong> {practice.benefit}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {Object.entries(codeSnippets).map(([key, code], idx) => (
              <div
                key={idx}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <Code size={24} color="#667eea" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#1f2937', textTransform: 'capitalize' }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                </div>
                <pre style={{
                  background: '#1f2937',
                  color: '#f3f4f6',
                  padding: '20px',
                  borderRadius: '12px',
                  overflow: 'auto',
                  fontSize: '0.85rem',
                  lineHeight: '1.6',
                  margin: 0
                }}>
                  <code>{code}</code>
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* Summary Card */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          borderRadius: '20px',
          padding: '32px',
          marginTop: '24px',
          color: 'white',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)'
        }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.5rem', fontWeight: '700' }}>
            📊 Review Summary
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '4px' }}>
                {criticalIssues.length}
              </div>
              <div style={{ opacity: 0.9 }}>Critical Issues Found</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '4px' }}>
                {improvements.reduce((sum, cat) => sum + cat.items.length, 0)}
              </div>
              <div style={{ opacity: 0.9 }}>Improvement Suggestions</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '4px' }}>
                {securityConcerns.length}
              </div>
              <div style={{ opacity: 0.9 }}>Security Concerns</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '4px' }}>
                {bestPractices.length}
              </div>
              <div style={{ opacity: 0.9 }}>Best Practices</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}