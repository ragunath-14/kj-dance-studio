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

export const DataProvider = ({ children, isAuthenticated }) => {
  const [students,      setStudents]      = useState({ data: [], total: 0, page: 1, limit: 50, totalPages: 1 });
  const [unpaidStudents,setUnpaidStudents]= useState({ data: [], total: 0, page: 1, limit: 50, totalPages: 1 });
  const [allStudents,   setAllStudents]   = useState([]);   // for dropdowns / payment form
  const [payments,      setPayments]      = useState({ data: [], total: 0, page: 1, limit: 50, totalPages: 1 });
  const [registrations, setRegistrations] = useState([]);
  const [stats,         setStats]         = useState(null);
  const [toasts,        setToasts]        = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

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

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchAllData();

    // Connect socket.io directly to the backend URL.
    // In dev: uses VITE_SOCKET_URL=http://localhost:5001 (bypasses Vite proxy — avoids ECONNABORTED).
    // In production: backend and frontend are on the same origin, so use window.location.origin.
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] });

    // Handle incoming real-time socket events with debouncing to prevent twinkling/flickering
    socket.on('dataChanged', (payload) => {
      console.log('⚡ Real-time data changed event:', payload);
      debouncedRefresh(true);

      if (payload && payload.type === 'registration') {
        showToast(`🎉 New pending registration received for ${payload.name || 'a student'}!`);
      } else if (payload && payload.type === 'student' && payload.action === 'create') {
        showToast(`👤 Student added successfully!`);
      } else if (payload && payload.type === 'payment' && payload.action === 'create') {
        showToast(`💰 Payment recorded successfully!`);
      }
    });

    socket.on('registrationApproved', (payload) => {
      debouncedRefresh(true);
      if (payload && payload.name) {
        showToast(`🎓 Registration approved for ${payload.name}!`);
      }
    });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      socket.disconnect();
    };
  }, [isAuthenticated, fetchAllData, debouncedRefresh, showToast]);

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
      showToast,
    }}>
      {children}
      
      {/* Floating Glassmorphic Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast-card ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' ? '✨' : '🔔'}
            </span>
            <div className="toast-message">{toast.message}</div>
            <button className="toast-close-btn" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
      <style>{`
        .admin-root .toast-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 9999;
          pointer-events: none;
        }
        .admin-root .toast-card {
          pointer-events: auto;
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.92) 0%, rgba(15, 23, 42, 0.96) 100%);
          border: 1px solid rgba(255, 140, 0, 0.3) !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 140, 0, 0.15) !important;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 16px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #ffffff;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          font-size: 0.88rem;
          font-weight: 700;
          min-width: 285px;
          max-width: 400px;
          animation: toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .admin-root .toast-icon {
          font-size: 1.2rem;
          filter: drop-shadow(0 0 8px rgba(255, 140, 0, 0.4));
        }
        .admin-root .toast-message {
          flex: 1;
          line-height: 1.4;
        }
        .admin-root .toast-close-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          font-size: 1.25rem;
          font-weight: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          transition: all 0.2s;
        }
        .admin-root .toast-close-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
        }
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </DataContext.Provider>
  );
};
