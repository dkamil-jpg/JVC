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

  // Logout function
  const logout = useCallback(async () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
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

  // Auto-logout after inactivity
  useEffect(() => {
    if (!user || !token) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    const performAutoLogout = () => {
      console.log('Auto-logout: User inactive for 5 minutes');
      localStorage.removeItem('jv_token');
      setToken(null);
      setUser(null);
      window.location.href = '/login';
    };

    const startTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(performAutoLogout, INACTIVITY_TIMEOUT);
    };

    // Reset timer on any activity
    const handleActivity = () => {
      startTimer();
    };

    // Activity events
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Add listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    startTimer();
    console.log('Inactivity timer started - will logout after 5 minutes of inactivity');

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [user, token]);

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
      isManager: user?.role === 'MANAGER' || user?.role === 'ADMIN'
    }}>
      {children}
    </AuthContext.Provider>
  );
};
