import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ClinicContext = createContext(null);

export const useClinic = () => {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error('useClinic must be used within ClinicProvider');
  }
  return context;
};

export const ClinicProvider = ({ children }) => {
  const { api, token } = useAuth();
  
  const [patients, setPatients] = useState([]);
  const [queue, setQueue] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await api().get('/dashboard');
      if (response.data.success) {
        setPatients(response.data.all);
        setQueue(response.data.queue);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  const loadPatient = useCallback(async (patientId) => {
    try {
      const response = await api().get(`/patients/${patientId}`);
      setSelectedPatient(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to load patient:', error);
      return null;
    }
  }, [api]);

  const updatePatient = useCallback(async (patientId, data) => {
    try {
      await api().put(`/patients/${patientId}`, data);
      await loadDashboardData();
      if (selectedPatient?.patient_id === patientId) {
        await loadPatient(patientId);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Update failed' };
    }
  }, [api, loadDashboardData, loadPatient, selectedPatient]);

  const deletePatient = useCallback(async (patientId, password) => {
    try {
      await api().delete(`/patients/${patientId}`, { params: { password } });
      setSelectedPatient(null);
      await loadDashboardData();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Delete failed' };
    }
  }, [api, loadDashboardData]);

  const getPatientVisits = useCallback(async (patientId) => {
    try {
      const response = await api().get(`/visits/${patientId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to load visits:', error);
      return [];
    }
  }, [api]);

  const createVisit = useCallback(async (data) => {
    try {
      await api().post('/visits', data);
      await loadDashboardData();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Failed to create visit' };
    }
  }, [api, loadDashboardData]);

  const getPatientAudit = useCallback(async (patientId) => {
    try {
      const response = await api().get(`/patients/${patientId}/audit`);
      return response.data;
    } catch (error) {
      console.error('Failed to load audit:', error);
      return [];
    }
  }, [api]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (token) {
      loadDashboardData();
      const interval = setInterval(loadDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [token, loadDashboardData]);

  return (
    <ClinicContext.Provider value={{
      patients,
      queue,
      selectedPatient,
      setSelectedPatient,
      loading,
      loadDashboardData,
      loadPatient,
      updatePatient,
      deletePatient,
      getPatientVisits,
      createVisit,
      getPatientAudit
    }}>
      {children}
    </ClinicContext.Provider>
  );
};
