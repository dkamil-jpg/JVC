import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Inactivity timeout - 5 minutes in milliseconds
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
const WARNING_BEFORE_LOGOUT = 30 * 1000;
const ACTIVITY_KEY = 'jv_last_activity';
const CHECK_INTERVAL = 1000; // Check every 1 second for smoother countdown

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
  
  const checkIntervalRef = useRef(null);
  const warningShownRef = useRef(false);

  // Get last activity from localStorage
  const getLastActivity = () => {
    const stored = localStorage.getItem(ACTIVITY_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  };

  // Update last activity in localStorage
  const updateLastActivity = () => {
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  };

  // Get time remaining until logout (in ms)
  const getTimeRemaining = () => {
    const lastActivity = getLastActivity();
    const elapsed = Date.now() - lastActivity;
    return Math.max(0, INACTIVITY_TIMEOUT - elapsed);
  };

  // Force logout
  const forceLogout = useCallback(() => {
    console.log('Session expired - logging out');
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    
    localStorage.removeItem('jv_token');
    localStorage.removeItem(ACTIVITY_KEY);
    warningShownRef.current = false;
    setShowInactivityWarning(false);
    setToken(null);
    setUser(null);
    window.location.replace('/');
  }, []);

  // Logout function (manual)
  const logout = useCallback(async () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    
    warningShownRef.current = false;
    setShowInactivityWarning(false);
    
    try {
      const instance = axios.create({
        baseURL: API,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      await instance.post('/auth/logout');
    } catch (e) {
      // Ignore errors
    }
    localStorage.removeItem('jv_token');
    localStorage.removeItem(ACTIVITY_KEY);
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
          localStorage.removeItem(ACTIVITY_KEY);
          setToken(null);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );
    
    return instance;
  }, [token]);

  // Stay logged in - reset activity
  const stayLoggedIn = useCallback(() => {
    updateLastActivity();
    warningShownRef.current = false;
    setShowInactivityWarning(false);
    setWarningCountdown(30);
  }, []);

  // Main inactivity check effect
  useEffect(() => {
    if (!user || !token) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      warningShownRef.current = false;
      setShowInactivityWarning(false);
      return;
    }

    // Check on mount - if already expired, logout immediately
    const timeRemaining = getTimeRemaining();
    if (timeRemaining <= 0) {
      console.log('Session already expired on mount');
      forceLogout();
      return;
    }

    // Initialize last activity if not set
    if (!localStorage.getItem(ACTIVITY_KEY)) {
      updateLastActivity();
    }

    // Handle user activity (clicks, keypress, touch)
    const handleActivity = () => {
      const remaining = getTimeRemaining();
      if (remaining <= 0) {
        forceLogout();
        return;
      }
      
      // Update activity and hide warning
      updateLastActivity();
      warningShownRef.current = false;
      setShowInactivityWarning(false);
      setWarningCountdown(30);
    };

    // Periodic check for inactivity
    const checkInactivity = () => {
      const remaining = getTimeRemaining();
      
      // Session expired
      if (remaining <= 0) {
        forceLogout();
        return;
      }
      
      // Should show warning (last 30 seconds)
      if (remaining <= WARNING_BEFORE_LOGOUT) {
        if (!warningShownRef.current) {
          console.log('Showing inactivity warning - ' + Math.ceil(remaining/1000) + 's remaining');
          warningShownRef.current = true;
          setShowInactivityWarning(true);
        }
        // Update countdown
        setWarningCountdown(Math.ceil(remaining / 1000));
      } else {
        // Not in warning zone
        if (warningShownRef.current) {
          warningShownRef.current = false;
          setShowInactivityWarning(false);
          setWarningCountdown(30);
        }
      }
    };

    // Only clicks, keypress, touch
    const events = ['click', 'keydown', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start periodic check every 1 second
    checkIntervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL);
    
    // Run initial check
    checkInactivity();
    
    console.log('Inactivity monitor active - ' + Math.ceil(getTimeRemaining()/1000) + 's until logout');

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [user, token, forceLogout]);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        // First check if session expired based on localStorage
        const remaining = getTimeRemaining();
        if (remaining <= 0) {
          console.log('Session expired - clearing token');
          localStorage.removeItem('jv_token');
          localStorage.removeItem(ACTIVITY_KEY);
          setToken(null);
          setLoading(false);
          return;
        }
        
        try {
          const response = await api().get('/auth/me');
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem('jv_token');
          localStorage.removeItem(ACTIVITY_KEY);
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
      updateLastActivity();
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
      showInactivityWarning,
      warningCountdown,
      stayLoggedIn
    }}>
      {children}
    </AuthContext.Provider>
  );
};
