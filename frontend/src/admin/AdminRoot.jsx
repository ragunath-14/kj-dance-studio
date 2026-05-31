import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import PaymentList from './components/PaymentList';
import RegistrationList from './components/students/RegistrationList';
import Login from './pages/Login';
import API_URL from './config';
import './Admin.css';

// Protected Route Component
const ProtectedRoute = ({ children, isAuthenticated }) => {
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
};

function AdminRoot() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAdminAuth') === 'true';
  });
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('adminToken');
      if (token && isAuthenticated) {
        try {
          await axios.get(`${API_URL}/auth/verify`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setIsAuthenticated(true);
        } catch (err) {
          console.error('Auth verification failed', err);
          handleLogin(false);
        }
      } else {
        handleLogin(false);
      }
      setCheckingAuth(false);
    };

    verifyAuth();
  }, []);

  const handleLogin = (status) => {
    setIsAuthenticated(status);
    if (status) {
      localStorage.setItem('isAdminAuth', 'true');
    } else {
      localStorage.removeItem('isAdminAuth');
      localStorage.removeItem('adminToken');
    }
  };

  if (checkingAuth) {
    return <div className="loading-screen">Verifying session...</div>;
  }

  return (
    <ThemeProvider>
      <Routes>
        <Route 
          path="login" 
          element={
            isAuthenticated ? 
            <Navigate to="/admin" replace /> : 
            <Login onLogin={handleLogin} />
          } 
        />
        
        <Route path="*" element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <DataProvider>
              <Layout onLogout={() => handleLogin(false)}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="students" element={<StudentList />} />
                  <Route path="payments" element={<PaymentList />} />
                  <Route path="registrations" element={<RegistrationList />} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Routes>
              </Layout>
            </DataProvider>
          </ProtectedRoute>
        } />
      </Routes>
    </ThemeProvider>
  );
}

export default AdminRoot;
