import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
