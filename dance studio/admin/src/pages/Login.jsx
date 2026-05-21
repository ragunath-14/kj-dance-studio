import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // A simple authorization check (password is "admin123" for demo purposes)
    if (password === 'admin123') {
      onLogin(true);
      navigate('/');
    } else {
      setError('Invalid password');
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
