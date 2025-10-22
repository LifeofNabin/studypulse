import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        login(token, user);

        if (user.role === 'teacher') {
          navigate('/teacher');
        } else {
          navigate('/student');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate, login]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '16px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔄</div>
        <h2>Authenticating...</h2>
        <p>Please wait while we sign you in</p>
      </div>
    </div>
  );
};

export default AuthCallback;