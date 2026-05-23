import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import API_URL from '../config';

// ── Axios: attach admin token to every request (module-level, runs once) ────
let interceptorId = null;
if (interceptorId === null) {
  interceptorId = axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('adminToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

const DataContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};

export const DataProvider = ({ children }) => {
  const [students,      setStudents]      = useState({ data: [], total: 0, page: 1, limit: 50, totalPages: 1 });
  const [unpaidStudents,setUnpaidStudents]= useState({ data: [], total: 0, page: 1, limit: 50, totalPages: 1 });
  const [allStudents,   setAllStudents]   = useState([]);   // for dropdowns / payment form
  const [payments,      setPayments]      = useState({ data: [], total: 0, page: 1, limit: 50, totalPages: 1 });
  const [registrations, setRegistrations] = useState([]);
  const [stats,         setStats]         = useState(null);

  // Granular loading flags
  const [loading,         setLoading]         = useState(true);   // global loading
  const [statsLoading,    setStatsLoading]     = useState(true);
  const [studentsLoading, setStudentsLoading]  = useState(false);
  const [paymentsLoading, setPaymentsLoading]  = useState(false);

  const studentParamsRef = useRef({ page: 1, limit: 50, search: '', classType: '' });
  const paymentParamsRef = useRef({ page: 1, limit: 50 });
  const unpaidParamsRef  = useRef({ page: 1, limit: 50 });

  const debounceTimerRef = useRef(null);

  // ── Individual fetchers ────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/students/dashboard/stats`);
      setStats(res.data);
    } catch (err) {
      console.error('Stats fetch failed:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchAllStudents = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/students`, { params: { limit: 1000 } });
      setAllStudents(res.data.data || []);
    } catch (err) {
      console.error('All students fetch failed:', err);
    }
  }, []);

  const fetchStudents = useCallback(async (page = 1, limit = 50, search = '', classType = '') => {
    setStudentsLoading(true);
    try {
      studentParamsRef.current = { page, limit, search, classType };
      const res = await axios.get(`${API_URL}/students`, { params: { page, limit, search, classType } });
      setStudents(res.data);
    } catch (err) {
      console.error('Students fetch failed:', err);
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const fetchPayments = useCallback(async (page = 1, limit = 50) => {
    setPaymentsLoading(true);
    try {
      paymentParamsRef.current = { page, limit };
      const res = await axios.get(`${API_URL}/payments`, { params: { page, limit } });
      setPayments(res.data);
    } catch (err) {
      console.error('Payments fetch failed:', err);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const fetchUnpaidStudents = useCallback(async (page = 1, limit = 50) => {
    try {
      unpaidParamsRef.current = { page, limit };
      const res = await axios.get(`${API_URL}/students/unpaid`, { params: { page, limit } });
      setUnpaidStudents(res.data);
    } catch (err) {
      console.error('Unpaid fetch failed:', err);
    }
  }, []);

  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/registrations/pending`);
      setRegistrations(res.data);
    } catch (err) {
      console.error('Registrations fetch failed:', err);
    }
  }, []);

  // ── Full data refresh (initial or after mutations) ─────────────────────────
  const fetchAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const sp = studentParamsRef.current;
      const pp = paymentParamsRef.current;
      const up = unpaidParamsRef.current;
      await Promise.all([
        fetchStats(),
        fetchAllStudents(),
        fetchStudents(sp.page, sp.limit, sp.search, sp.classType),
        fetchPayments(pp.page, pp.limit),
        fetchUnpaidStudents(up.page, up.limit),
        fetchRegistrations(),
      ]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fetchStats, fetchAllStudents, fetchStudents, fetchPayments, fetchUnpaidStudents, fetchRegistrations]);

  // ── Debounced refresh: coalesces rapid consecutive mutations / socket events ──
  const debouncedRefresh = useCallback((silent = true) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchAllData(silent);
    }, 250);
  }, [fetchAllData]);

  // ── Initial load + Socket.io real-time updates ─────────────────────────────
  useEffect(() => {
    fetchAllData();

    const socketUrl = API_URL.replace(/\/api$/, '');
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] });

    // Handle incoming real-time socket events with debouncing to prevent twinkling/flickering
    socket.on('dataChanged',          () => debouncedRefresh(true));
    socket.on('registrationApproved', () => debouncedRefresh(true));

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Action helpers ─────────────────────────────────────────────────────────
  const refreshData = useCallback(() => debouncedRefresh(false), [debouncedRefresh]);

  const approveRegistration = async (id) => {
    try {
      await axios.post(`${API_URL}/registrations/${id}/approve`);
      debouncedRefresh(true);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || err.message };
    }
  };

  const rejectRegistration = async (id) => {
    try {
      await axios.post(`${API_URL}/registrations/${id}/reject`);
      debouncedRefresh(true);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const toggleStudentStatus = async (id) => {
    try {
      const res = await axios.patch(`${API_URL}/students/${id}/toggle-status`);
      debouncedRefresh(true);
      return { success: true, message: res.data.message };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || err.message };
    }
  };

  return (
    <DataContext.Provider value={{
      students,
      unpaidStudents,
      allStudents,
      payments,
      registrations,
      stats,
      loading,
      statsLoading,
      studentsLoading,
      paymentsLoading,
      refreshData,
      fetchStudents,
      fetchPayments,
      fetchUnpaidStudents,
      approveRegistration,
      rejectRegistration,
      toggleStudentStatus,
    }}>
      {children}
    </DataContext.Provider>
  );
};
