import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const Login = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/admin/login', { password });
      if (response.data.success && response.data.token) {
        localStorage.setItem('adminToken', response.data.token);
        onLogin(true);
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid password');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Admin Login</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="btn btn-primary btn-full">Login</button>
        </form>
        <button className="back-btn" onClick={() => window.location.href = '/'}>
          Back to Site
        </button>
      </div>
    </div>
  );
};

export default Login;
