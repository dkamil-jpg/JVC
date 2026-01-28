import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Inactivity timeout - 5 minutes (300000ms)
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('jv_token'));
  const [loading, setLoading] = useState(true);
  const inactivityTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const api = useCallback(() => {
    const instance = axios.create({
      baseURL: API,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    
    instance.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    
    return instance;
  }, [token]);

  // Auto-logout function
  const performAutoLogout = useCallback(async () => {
    console.log('Auto-logout: User inactive for 5 minutes');
    try {
      await api().post('/auth/logout');
    } catch (e) {
      // Ignore errors on logout
    }
    localStorage.removeItem('jv_token');
    setToken(null);
    setUser(null);
    // Redirect to login page
    window.location.href = '/login';
  }, [api]);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Only set timer if user is logged in
    if (token && user) {
      inactivityTimerRef.current = setTimeout(() => {
        performAutoLogout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [token, user, performAutoLogout]);

  // Set up activity listeners when user is logged in
  useEffect(() => {
    if (!user || !token) {
      // Clear timer if not logged in
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    // Activity events to track
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Throttled activity handler - only update every 30 seconds to avoid performance issues
    let throttleTimer = null;
    const handleActivity = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          resetInactivityTimer();
        }, 30000); // Throttle: update timer max once per 30 seconds
      }
      // Always update last activity time immediately
      lastActivityRef.current = Date.now();
    };

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
    };
  }, [user, token, resetInactivityTimer]);

  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const response = await api().get('/auth/me');
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem('jv_token');
          setToken(null);
        }
      }
      setLoading(false);
    };
    verifyToken();
  }, [token, api]);

  const login = async (username, password) => {
    const response = await axios.post(`${API}/auth/login`, { username, password });
    if (response.data.success) {
      const { token: newToken, username: user, role } = response.data;
      localStorage.setItem('jv_token', newToken);
      setToken(newToken);
      setUser({ username: user, role });
      return { success: true };
    }
    return { success: false, error: response.data.error };
  };

  const logout = async () => {
    try {
      await api().post('/auth/logout');
    } catch (e) {
      // Ignore errors on logout
    }
    localStorage.removeItem('jv_token');
    setToken(null);
    setUser(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    const response = await api().post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword
    });
    return response.data;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      logout, 
      changePassword,
      api,
      isAdmin: user?.role === 'ADMIN',
      isManager: user?.role === 'MANAGER' || user?.role === 'ADMIN'
    }}>
      {children}
    </AuthContext.Provider>
  );
};
