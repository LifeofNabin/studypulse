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
  const [token, setToken] = useState(localStorage.getItem('token'));
  const refreshTimerRef = useRef(null);
  const isRefreshingRef = useRef(false);

  // Configure axios defaults
  axios.defaults.withCredentials = true; // CRITICAL: Enable cookies
  axios.defaults.baseURL = API_BASE_URL;

  // Refresh token function
  const refreshAccessToken = useCallback(async () => {
    // Prevent multiple simultaneous refresh attempts
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
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
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

  // Setup automatic token refresh (refresh 5 minutes before expiry)
  useEffect(() => {
    if (token) {
      // Clear any existing timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      // Set timer to refresh token after 25 minutes (30 min - 5 min buffer)
      const refreshInterval = 25 * 60 * 1000; // 25 minutes in milliseconds
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
  }, [token, refreshAccessToken]);

  // Setup axios interceptor to handle 401 errors automatically
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and we haven't tried refreshing yet for this request
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          console.log('🔐 Got 401 error, attempting token refresh...');
          const refreshed = await refreshAccessToken();
          
          if (refreshed) {
            // Retry the original request with new token
            const newToken = localStorage.getItem('token');
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
  }, [refreshAccessToken]);

  // Initialize - Setup axios with token and verify on mount
  useEffect(() => {
    const initialize = async () => {
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        try {
          // Try to verify the current token
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
          // If token is invalid, try to refresh
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
  }, []); // Only run on mount

  // Login
  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', 
        { email, password },
        { withCredentials: true }
      );
      
      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      console.log('✓ Login successful for:', email);
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
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
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
  const logout = async () => {
    try {
      // Call logout endpoint to clear refresh token from server
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
      console.log('✓ Server logout successful');
    } catch (error) {
      console.error('⚠️ Server logout error:', error);
      // Continue with client-side logout even if server call fails
    } finally {
      // Clear refresh timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      
      // Clear all auth data
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      
      console.log('✓ Client logout complete');
      
      // Redirect to login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    token,
    refreshAccessToken, // Expose for manual refresh if needed
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};