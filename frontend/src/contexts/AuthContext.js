import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Inactivity timeout - 5 minutes (300000ms), warning 30 seconds before
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
const WARNING_BEFORE_LOGOUT = 30 * 1000; // 30 seconds warning

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
  
  // Inactivity warning state
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(30);
  
  const inactivityTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Logout function
  const logout = useCallback(async () => {
    // Clear all timers
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    inactivityTimerRef.current = null;
    warningTimerRef.current = null;
    countdownIntervalRef.current = null;
    
    setShowInactivityWarning(false);
    
    try {
      const instance = axios.create({
        baseURL: API,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      await instance.post('/auth/logout');
    } catch (e) {
      // Ignore errors on logout
    }
    localStorage.removeItem('jv_token');
    setToken(null);
    setUser(null);
  }, [token]);

  const api = useCallback(() => {
    const instance = axios.create({
      baseURL: API,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    
    instance.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          localStorage.removeItem('jv_token');
          setToken(null);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );
    
    return instance;
  }, [token]);

  // Stay logged in - reset timer
  const stayLoggedIn = useCallback(() => {
    setShowInactivityWarning(false);
    setWarningCountdown(30);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    warningTimerRef.current = null;
    countdownIntervalRef.current = null;
  }, []);

  // Auto-logout after inactivity
  useEffect(() => {
    if (!user || !token) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      inactivityTimerRef.current = null;
      warningTimerRef.current = null;
      countdownIntervalRef.current = null;
      setShowInactivityWarning(false);
      return;
    }

    const performAutoLogout = () => {
      console.log('Auto-logout: User inactive');
      setShowInactivityWarning(false);
      localStorage.removeItem('jv_token');
      setToken(null);
      setUser(null);
      window.location.href = '/login';
    };

    const showWarning = () => {
      console.log('Showing inactivity warning - 30 seconds to logout');
      setShowInactivityWarning(true);
      setWarningCountdown(30);
      
      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setWarningCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Set final logout timer
      warningTimerRef.current = setTimeout(performAutoLogout, WARNING_BEFORE_LOGOUT);
    };

    const startTimer = () => {
      // Clear existing timers
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      
      // Hide warning if shown
      setShowInactivityWarning(false);
      setWarningCountdown(30);
      
      // Start timer for warning (5 min - 30 sec = 4.5 min)
      inactivityTimerRef.current = setTimeout(showWarning, INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT);
    };

    // Reset timer on any activity (only if warning not shown)
    const handleActivity = () => {
      if (!showInactivityWarning) {
        startTimer();
      }
    };

    // Activity events
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Add listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    startTimer();
    console.log('Inactivity timer started - warning at 4.5 min, logout at 5 min');

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user, token, showInactivityWarning]);

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
      isManager: user?.role === 'MANAGER' || user?.role === 'ADMIN',
      // Inactivity warning
      showInactivityWarning,
      warningCountdown,
      stayLoggedIn
    }}>
      {children}
    </AuthContext.Provider>
  );
};
