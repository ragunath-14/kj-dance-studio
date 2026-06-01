import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import API_URL from '../config';

const DataContext = createContext();

// Setup Axios Interceptors for Authorization
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 Unauthorized
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('isAdminAuth');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};

export const DataProvider = ({ children }) => {
  const [students, setStudents] = useState({ data: [], total: 0, page: 1, limit: 50 });
  const [unpaidStudents, setUnpaidStudents] = useState({ data: [], total: 0, page: 1, limit: 50 });
  const [allStudents, setAllStudents] = useState([]); // For dropdowns
  const [payments, setPayments] = useState({ data: [], total: 0, page: 1, limit: 50 });
  const [registrations, setRegistrations] = useState({ data: [], total: 0, page: 1, limit: 10 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null); // { message, type }
  
  // Track last used params to prevent "mixed list" on refresh
  const [studentParams, setStudentParams] = useState({ page: 1, limit: 50, search: '', classType: 'Regular Class', studentCategory: '' });
  const [paymentParams, setPaymentParams] = useState({ page: 1, limit: 50, search: '', studentCategory: '' });
  const [unpaidParams, setUnpaidParams]   = useState({ page: 1, limit: 50, search: '', studentCategory: '' });

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/dashboard/stats`);
      setStats(res.data);
    } catch (err) {
      console.error('Stats fetch failed:', err);
    }
  };

  const fetchAllStudents = async () => {
    try {
      const res = await axios.get(`${API_URL}/students`, { params: { limit: 1000 } });
      setAllStudents(res.data.data);
    } catch (err) {
      console.error('All students fetch failed:', err);
    }
  };

  const fetchStudents = async (page = 1, limit = 50, search = '', classType = '', studentCategory = '') => {
    setStudentParams({ page, limit, search, classType, studentCategory });
    try {
      const res = await axios.get(`${API_URL}/students`, { params: { page, limit, search, classType, studentCategory } });
      setStudents(res.data);
    } catch (err) {
      console.error('Students fetch failed:', err);
    }
  };

  const fetchPayments = async (page = 1, limit = 50, search = '', studentCategory = '') => {
    setPaymentParams({ page, limit, search, studentCategory });
    try {
      const res = await axios.get(`${API_URL}/payments`, { params: { page, limit, search, studentCategory } });
      setPayments(res.data);
    } catch (err) {
      console.error('Payments fetch failed:', err);
    }
  };

  const fetchUnpaidStudents = async (page = 1, limit = 50, search = '', studentCategory = '') => {
    setUnpaidParams({ page, limit, search, studentCategory });
    try {
      const res = await axios.get(`${API_URL}/students/unpaid`, { params: { page, limit, search, studentCategory } });
      setUnpaidStudents(res.data);
    } catch (err) {
      console.error('Unpaid fetch failed:', err);
    }
  };

  const fetchRegistrations = async (page = 1, limit = 10) => {
    try {
      // Backend returns a plain array; normalize it to {data, total, page, limit}
      const res = await axios.get(`${API_URL}/registrations/pending`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setRegistrations({
        data: list,
        total: list.length,
        page: 1,
        limit: list.length || 10,
        totalPages: 1
      });
    } catch (err) {
      console.error('Registrations fetch failed:', err);
    }
  };

  const fetchActivity = async (page = 1, limit = 20) => {
    try {
      const res = await axios.get(`${API_URL}/students/activity`, { params: { page, limit } });
      return res.data;
    } catch (err) {
      console.error('Activity fetch failed:', err);
      return { data: [], total: 0, page: 1, limit, totalPages: 0 };
    }
  };

  const fetchAllData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchAllStudents(),
        fetchStudents(studentParams.page, studentParams.limit, studentParams.search, studentParams.classType, studentParams.studentCategory),
        fetchPayments(paymentParams.page, paymentParams.limit, paymentParams.search, paymentParams.studentCategory),
        fetchUnpaidStudents(unpaidParams.page, unpaidParams.limit, unpaidParams.search, unpaidParams.studentCategory),
        fetchRegistrations()
      ]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    // Derive the socket server URL:
    // - In dev: Vite proxies /socket.io → localhost:5001, so use window.location.origin
    // - In prod: same origin as the page (Express serves everything)
    const socketUrl = window.location.origin;

    const socket = io(socketUrl, {
      // Don't block page load — connect in background
      autoConnect: true,
      // Polling first, then upgrade to WebSocket (more reliable behind proxies)
      transports: ['polling', 'websocket'],
      // Backoff settings — prevents hammering the proxy when backend is down
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,        // start at 3s
      reconnectionDelayMax: 30000,    // cap at 30s
      randomizationFactor: 0.5,       // add jitter to spread reconnects
      timeout: 8000,
    });

    let warnedOffline = false;

    socket.on('connect', () => {
      warnedOffline = false; // reset on successful connect
    });

    socket.on('connect_error', () => {
      // Only log once per disconnection cycle, not on every retry
      if (!warnedOffline) {
        console.warn('[Socket] Backend unreachable — real-time updates paused. Retrying...');
        warnedOffline = true;
      }
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server intentionally disconnected — reconnect manually
        socket.connect();
      }
    });

    socket.on('dataChanged', (payload) => {
      fetchAllData(true);
      if (payload && payload.type === 'registration') {
        setNotification({
          message: `New Enquiry: ${payload.name || 'A student'} has just registered!`,
          type: 'info'
        });
        setTimeout(() => setNotification(null), 5000);
      }
    });

    socket.on('registrationApproved', () => fetchAllData(true));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  const refreshData = () => fetchAllData();

  const approveRegistration = async (id) => {
    try {
      await axios.post(`${API_URL}/registrations/${id}/approve`);
      fetchAllData(true);
      return { success: true };
    } catch (err) {
      // 409 = student already exists; backend still marks the reg as approved
      // Treat it as a soft-success so the list refreshes and the card disappears
      if (err.response?.status === 409) {
        fetchAllData(true);
        return { success: false, message: err.response.data?.message || 'Student already exists — registration marked as approved.' };
      }
      return { success: false, message: err.response?.data?.message || err.message };
    }
  };

  const rejectRegistration = async (id) => {
    try {
      await axios.post(`${API_URL}/registrations/${id}/reject`);
      fetchAllData(true);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const toggleStudentStatus = async (id) => {
    try {
      const res = await axios.patch(`${API_URL}/students/${id}/toggle-status`);
      await fetchAllData(true);
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
      notification,
      setNotification,
      refreshData,
      fetchStudents,
      fetchPayments,
      fetchUnpaidStudents,
      fetchActivity,
      fetchRegistrations,
      approveRegistration,
      rejectRegistration,
      toggleStudentStatus
    }}>
      {children}
    </DataContext.Provider>
  );
};
