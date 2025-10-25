// frontend/src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);
  const isRefreshingRef = useRef(false);
  const initializationRef = useRef(false);

  // Configure axios defaults
  axios.defaults.withCredentials = true;
  axios.defaults.baseURL = API_BASE_URL;

  // Get token based on user role
  const getToken = useCallback(() => {
    const teacherToken = localStorage.getItem('teacher_token');
    const studentToken = localStorage.getItem('student_token');
    const genericToken = localStorage.getItem('token');
    return teacherToken || studentToken || genericToken;
  }, []);

  // Refresh token function
  const refreshAccessToken = useCallback(async () => {
    if (isRefreshingRef.current) {
      console.log('⏳ Token refresh already in progress...');
      return false;
    }

    try {
      isRefreshingRef.current = true;
      console.log('🔄 Refreshing access token...');
      
      const response = await axios.post('/api/auth/refresh', {}, {
        withCredentials: true
      });
      
      const { access_token, user: userData } = response.data;
      
      setUser(userData);
      const tokenKey = userData.role === 'teacher' ? 'teacher_token' : 'student_token';
      
      // Store BOTH role-specific AND generic token
      localStorage.setItem(tokenKey, access_token);
      localStorage.setItem('token', access_token); // CRITICAL: Store generic token
      localStorage.setItem('user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      console.log('✓ Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('❌ Token refresh failed:', error.response?.data || error.message);
      logout();
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  // Setup automatic token refresh
  useEffect(() => {
    const token = getToken();
    if (token) {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      const refreshInterval = 25 * 60 * 1000; // 25 minutes
      refreshTimerRef.current = setTimeout(() => {
        console.log('⏰ Auto-refresh timer triggered');
        refreshAccessToken();
      }, refreshInterval);

      console.log('⏰ Token auto-refresh scheduled for 25 minutes from now');
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [user, getToken, refreshAccessToken]);

  // Axios interceptor for 401
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          console.log('🔐 Got 401 error, attempting token refresh...');
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            const newToken = getToken();
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return axios(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [refreshAccessToken, getToken]);

  // Initialize on mount - ONLY ONCE
  useEffect(() => {
    if (initializationRef.current) {
      return;
    }
    initializationRef.current = true;

    const initialize = async () => {
      const token = getToken();
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        try {
          const response = await axios.get('/api/health');
          if (response.status === 200) {
            const userData = localStorage.getItem('user');
            if (userData) {
              setUser(JSON.parse(userData));
              console.log('✓ User authenticated from stored token');
            }
          }
        } catch (error) {
          console.log('⚠️ Stored token invalid, attempting refresh...');
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            console.log('❌ Could not refresh token, logging out');
          }
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    initialize();
  }, [getToken, refreshAccessToken]);

  // Login
  const login = async (email, password, role = 'student') => {
    try {
      const response = await axios.post('/api/auth/login', 
        { email, password },
        { withCredentials: true }
      );
      
      const { access_token, user: userData } = response.data;
      
      const tokenKey = userData.role === 'teacher' ? 'teacher_token' : 'student_token';
      setUser(userData);
      
      // Store BOTH role-specific AND generic token
      localStorage.setItem(tokenKey, access_token);
      localStorage.setItem('token', access_token); // CRITICAL: Store generic token
      localStorage.setItem('user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      console.log('✓ Login successful for:', email);
      console.log('✓ Token stored:', access_token.substring(0, 20) + '...');
      return { success: true };
    } catch (error) {
      console.error('❌ Login failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed. Please try again.' 
      };
    }
  };

  // Register
  const register = async (email, password, name, role = 'student') => {
    try {
      const response = await axios.post('/api/auth/register',
        { email, password, name, role },
        { withCredentials: true }
      );
      
      const { access_token, user: userData } = response.data;
      
      const tokenKey = userData.role === 'teacher' ? 'teacher_token' : 'student_token';
      setUser(userData);
      
      // Store BOTH role-specific AND generic token
      localStorage.setItem(tokenKey, access_token);
      localStorage.setItem('token', access_token); // CRITICAL: Store generic token
      localStorage.setItem('user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      console.log('✓ Registration successful for:', email);
      return { success: true };
    } catch (error) {
      console.error('❌ Registration failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Registration failed. Please try again.' 
      };
    }
  };

  // Logout
  const logout = async (role) => {
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
      console.log('✓ Server logout successful');
    } catch (error) {
      console.error('⚠️ Server logout error:', error);
    } finally {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      setUser(null);
      localStorage.removeItem('teacher_token');
      localStorage.removeItem('student_token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      
      console.log('✓ User logged out');
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    refreshAccessToken,
    isAuthenticated: !!user,
    getToken, // Export getToken for components to use
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};