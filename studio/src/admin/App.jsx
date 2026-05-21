import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import PaymentList from './components/PaymentList';
import RegistrationList from './components/students/RegistrationList';
import ActivityLog from './components/ActivityLog';
import Login from './pages/Login';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children, isAuthenticated }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAdminAuth') === 'true';
  });

  const handleLogin = (status) => {
    setIsAuthenticated(status);
    if (status) {
      localStorage.setItem('isAdminAuth', 'true');
    } else {
      localStorage.removeItem('isAdminAuth');
    }
  };

  return (
    <Router>
      <DataProvider>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          
          <Route path="/*" element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout onLogout={() => handleLogin(false)}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/students" element={<StudentList />} />
                  <Route path="/payments" element={<PaymentList />} />
                  <Route path="/registrations" element={<RegistrationList />} />
                  <Route path="/activity" element={<ActivityLog />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </DataProvider>
    </Router>
  );
}

export default App;
