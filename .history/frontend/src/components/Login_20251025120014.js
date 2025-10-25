import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      
      if (result.success) {
        // Login successful - AuthContext will redirect via App.js routing
        // No need to manually navigate here
        console.log('✅ Login successful, AuthContext will handle redirect');
      } else {
        setError(result.error);
        setLoading(false);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  // OAuth handlers
  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  const handleGitHubLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/github`;
  };

  return (
    <div className="landing-page">
      {/* Animated Background */}
      <div className="animated-background">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
        <div className="floating-particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className={`particle particle-${i + 1}`}></div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="landing-content">
        {/* Left Side - Branding & Features */}
        <div className="landing-left">
          <div className="brand-section">
            <div className="logo-container">
              <div className="logo-icon">
                <div className="logo-brain">
                  <div className="brain-waves">
                    <div className="wave wave-1"></div>
                    <div className="wave wave-2"></div>
                    <div className="wave wave-3"></div>
                  </div>
                </div>
              </div>
              <h1 className="brand-title">StudyGuardian</h1>
              <p className="brand-tagline">AI-Powered Study Monitoring & Analytics</p>
            </div>

            <div className="features-showcase">
              <div className="feature-item">
                <div className="feature-icon">
                  <div className="icon-circle">
                    <span>👁️</span>
                  </div>
                </div>
                <div className="feature-content">
                  <h3>Real-time Attention Tracking</h3>
                  <p>Advanced AI monitors your focus levels and provides instant feedback</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">
                  <div className="icon-circle">
                    <span>📊</span>
                  </div>
                </div>
                <div className="feature-content">
                  <h3>Detailed Analytics</h3>
                  <p>Comprehensive insights into your study patterns and productivity</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">
                  <div className="icon-circle">
                    <span>🎯</span>
                  </div>
                </div>
                <div className="feature-content">
                  <h3>Goal Achievement</h3>
                  <p>Set targets, track progress, and celebrate your learning milestones</p>
                </div>
              </div>
            </div>

            <div className="stats-section">
              <div className="stat-item">
                <div className="stat-number">95%</div>
                <div className="stat-label">Focus Improvement</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">10k+</div>
                <div className="stat-label">Active Students</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">4.9★</div>
                <div className="stat-label">User Rating</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="landing-right">
          <div className="login-container">
            <div className="login-card">
              <div className="login-header">
                <h2 className="login-title">Welcome Back</h2>
                <p className="login-subtitle">
                  Sign in to continue your learning journey
                </p>
                <div className="welcome-line"></div>
              </div>

              {error && (
                <div className="error-message">
                  <div className="error-icon">⚠️</div>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label htmlFor="email" className="form-label">
                    Email Address
                  </label>
                  <div className="input-wrapper">
                    <div className="input-icon">📧</div>
                    <input
                      id="email"
                      type="email"
                      className="form-input"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <div className="input-wrapper">
                    <div className="input-icon">🔒</div>
                    <input
                      id="password"
                      type="password"
                      className="form-input"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <div className="form-options">
                  <label className="remember-checkbox">
                    <input type="checkbox" />
                    <span className="checkmark"></span>
                    Remember me
                  </label>
                  <a href="#" className="forgot-link">Forgot password?</a>
                </div>

                <button
                  type="submit"
                  className="login-btn"
                  disabled={loading}
                >
                  <span className="btn-text">
                    {loading ? 'Signing In...' : 'Sign In'}
                  </span>
                  {loading && <div className="btn-spinner"></div>}
                  {!loading && <div className="btn-arrow">→</div>}
                </button>
              </form>

              <div className="login-divider">
                <span>or continue with</span>
              </div>

              <div className="social-login">
                <button 
                  className="social-btn google-btn"
                  onClick={handleGoogleLogin}
                  type="button"
                >
                  <div className="social-icon">G</div>
                  Google
                </button>
                <button 
                  className="social-btn github-btn"
                  onClick={handleGitHubLogin}
                  type="button"
                >
                  <div className="social-icon">⚡</div>
                  GitHub
                </button>
              </div>

              <div className="signup-link">
                Don't have an account? 
                <Link to="/register" className="signup-cta">
                  Create Account
                </Link>
              </div>
            </div>

            {/* Demo Credentials */}
            <div className="demo-credentials">
              <div className="demo-header">
                <span>Quick Demo Access</span>
              </div>
              <div className="demo-accounts">
                <div className="demo-account">
                  <strong>Teacher:</strong> teacher@demo.com / demo123
                </div>
                <div className="demo-account">
                  <strong>Student:</strong> student@demo.com / demo123
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Support</a>
            <a href="#">About</a>
          </div>
          <div className="footer-copyright">
            © 2024 StudyGuardian. Empowering focused learning.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Login;