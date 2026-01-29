import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Inactivity timeout - 5 minutes in milliseconds
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
const WARNING_BEFORE_LOGOUT = 30 * 1000;
const ACTIVITY_KEY = 'jv_last_activity';
const CHECK_INTERVAL = 5000; // Check every 5 seconds

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
  
  const countdownIntervalRef = useRef(null);
  const checkIntervalRef = useRef(null);

  // Get last activity from localStorage
  const getLastActivity = () => {
    const stored = localStorage.getItem(ACTIVITY_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  };

  // Update last activity in localStorage
  const updateLastActivity = () => {
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  };

  // Check if session expired
  const isSessionExpired = () => {
    const lastActivity = getLastActivity();
    const elapsed = Date.now() - lastActivity;
    return elapsed >= INACTIVITY_TIMEOUT;
  };

  // Check if should show warning (30 sec before expiry)
  const shouldShowWarning = () => {
    const lastActivity = getLastActivity();
    const elapsed = Date.now() - lastActivity;
    return elapsed >= (INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT) && elapsed < INACTIVITY_TIMEOUT;
  };

  // Force logout
  const forceLogout = useCallback(() => {
    console.log('Session expired - logging out');
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    
    localStorage.removeItem('jv_token');
    localStorage.removeItem(ACTIVITY_KEY);
    setShowInactivityWarning(false);
    setToken(null);
    setUser(null);
    // Redirect to home page (which will show login option)
    window.location.replace('/');
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    
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
    setShowInactivityWarning(false);
    setWarningCountdown(30);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Main inactivity check effect
  useEffect(() => {
    if (!user || !token) {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setShowInactivityWarning(false);
      return;
    }

    // Check on mount - if already expired, logout immediately
    if (isSessionExpired()) {
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
      // First check if already expired
      if (isSessionExpired()) {
        forceLogout();
        return;
      }
      
      // Update activity and hide warning
      updateLastActivity();
      if (showInactivityWarning) {
        setShowInactivityWarning(false);
        setWarningCountdown(30);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    };

    // Periodic check for inactivity (runs even without user interaction)
    const checkInactivity = () => {
      if (!user || !token) return;
      
      if (isSessionExpired()) {
        forceLogout();
        return;
      }
      
      if (shouldShowWarning() && !showInactivityWarning) {
        console.log('Showing inactivity warning');
        setShowInactivityWarning(true);
        setWarningCountdown(30);
        
        // Start countdown
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = setInterval(() => {
          setWarningCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
              // Final check and logout
              if (isSessionExpired()) {
                forceLogout();
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };

    // Only clicks, keypress, touch - NO mousemove or scroll
    const events = ['click', 'keydown', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start periodic check
    checkIntervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL);
    
    // Run initial check
    checkInactivity();
    
    console.log('Inactivity monitor active - 5 min timeout, checking every 5 sec');

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user, token, showInactivityWarning, forceLogout]);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        // First check if session expired based on localStorage
        if (isSessionExpired()) {
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
      updateLastActivity(); // Set initial activity timestamp
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
