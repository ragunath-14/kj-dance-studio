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
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null); // { message, type }
  
  // Track last used params to prevent "mixed list" on refresh
  const [studentParams, setStudentParams] = useState({ page: 1, limit: 50, search: '', classType: 'Regular Class' });
  const [paymentParams, setPaymentParams] = useState({ page: 1, limit: 50, search: '' });
  const [unpaidParams, setUnpaidParams] = useState({ page: 1, limit: 50, search: '' });

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

  const fetchStudents = async (page = 1, limit = 50, search = '', classType = '') => {
    setStudentParams({ page, limit, search, classType });
    try {
      const res = await axios.get(`${API_URL}/students`, { params: { page, limit, search, classType } });
      setStudents(res.data);
    } catch (err) {
      console.error('Students fetch failed:', err);
    }
  };

  const fetchPayments = async (page = 1, limit = 50, search = '') => {
    setPaymentParams({ page, limit, search });
    try {
      const res = await axios.get(`${API_URL}/payments`, { params: { page, limit, search } });
      setPayments(res.data);
    } catch (err) {
      console.error('Payments fetch failed:', err);
    }
  };

  const fetchUnpaidStudents = async (page = 1, limit = 50, search = '') => {
    setUnpaidParams({ page, limit, search });
    try {
      const res = await axios.get(`${API_URL}/students/unpaid`, { params: { page, limit, search } });
      setUnpaidStudents(res.data);
    } catch (err) {
      console.error('Unpaid fetch failed:', err);
    }
  };

  const fetchRegistrations = async () => {
    try {
      const res = await axios.get(`${API_URL}/registrations/pending`);
      setRegistrations(res.data);
    } catch (err) {
      console.error('Registrations fetch failed:', err);
    }
  };

  const fetchActivity = async (page = 1, limit = 20) => {
    try {
      const res = await axios.get(`${API_URL}/activity`, { params: { page, limit } });
      return res.data;
    } catch (err) {
      console.error('Activity fetch failed:', err);
      return { data: [], total: 0 };
    }
  };

  const fetchAllData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchAllStudents(),
        fetchStudents(studentParams.page, studentParams.limit, studentParams.search, studentParams.classType),
        fetchPayments(paymentParams.page, paymentParams.limit, paymentParams.search),
        fetchUnpaidStudents(unpaidParams.page, unpaidParams.limit, unpaidParams.search),
        fetchRegistrations()
      ]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    const socketUrl = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL.replace(/\/api$/, '');
    const socket = io(socketUrl);

    socket.on('dataChanged', (payload) => {
      fetchAllData(true);
      
      // If it's a new registration, show a toast
      if (payload && payload.type === 'registration') {
        setNotification({
          message: `New Enquiry: ${payload.name || 'A student'} has just registered!`,
          type: 'info'
        });
        // Clear after 5 seconds
        setTimeout(() => setNotification(null), 5000);
      }
    });

    socket.on('registrationApproved', () => fetchAllData(true));

    return () => socket.disconnect();
  }, []);

  const refreshData = () => fetchAllData();

  const approveRegistration = async (id) => {
    try {
      await axios.post(`${API_URL}/registrations/${id}/approve`);
      fetchAllData(true);
      return { success: true };
    } catch (err) {
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
      fetchAllData(true);
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
      approveRegistration,
      rejectRegistration,
      toggleStudentStatus
    }}>
      {children}
    </DataContext.Provider>
  );
};
