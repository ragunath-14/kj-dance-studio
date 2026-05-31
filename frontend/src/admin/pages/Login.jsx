import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import API_URL from '../config';
import './Login.css';

const Login = ({ onLogin }) => {
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_URL}/auth/login`, { adminId, password });

      if (res.data.success) {
        localStorage.setItem('adminToken', res.data.token);
        onLogin(true);
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid Admin ID or Password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" data-theme={theme}>
      <div className="login-card animate-fade-in">
        <div className="login-header">
          <h2>Admin Login</h2>
          <p>Access your dashboard</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Admin ID</label>
            <input 
              type="text" 
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              placeholder="Enter admin ID"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          {error && <div className="error-message">⚠️ {error}</div>}
          <button type="submit" className="btn-full" disabled={loading}>
            {loading ? 'Authenticating...' : 'Login to Dashboard'}
          </button>
        </form>
        <button className="back-btn" onClick={() => navigate('/')}>
          Back to Website
        </button>
      </div>
    </div>
  );
};

export default Login;
