import React, { useState } from 'react';
import { Menu, X, Bell, LogOut, Sun, Moon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import Sidebar from './Sidebar';
import logo from '../../assets/logo.png';
import './Layout.css';

const Layout = ({ children, onLogout }) => {
  const { registrations, notification, setNotification } = useData();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);

  return (
    <div 
      className={`layout ${isMobileMenuOpen ? 'mobile-menu-open' : ''} ${isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}
      data-theme={theme}
    >
      {/* Real-time Toast Notification */}
      {notification && (
        <div 
          className={`admin-toast ${notification.type}`}
          onClick={() => setNotification(null)}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#1e293b',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
            animation: 'slideInRight 0.3s ease-out'
          }}
        >
          <div style={{ background: '#3b82f6', width: '8px', height: '8px', borderRadius: '50%' }}></div>
          <span style={{ fontWeight: '500' }}>{notification.message}</span>
        </div>
      )}
      <div className="mobile-header">
        <button className="menu-toggle" onClick={toggleMobileMenu}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="mobile-logo-wrap">
          <img src={logo} alt="KJ" className="mobile-logo-img" />
          <span className="mobile-page-title">KJ Dance Studio</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button onClick={toggleTheme} className="mobile-theme-btn" title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NavLink to="/admin/registrations" className="topbar-notification" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '10px', color: 'var(--text-muted)', background: '#111', border: '1px solid var(--border-color)' }}>
            <Bell size={18} />
            {(registrations.data?.length > 0) && (
              <span className="notification-badge">{registrations.data.length}</span>
            )}
          </NavLink>
          {onLogout && (
            <button onClick={onLogout} className="mobile-logout-btn" title="Logout">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
      
      <div className={`sidebar-overlay ${isMobileMenuOpen ? 'show' : ''}`} onClick={toggleMobileMenu}></div>
      
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
        isExpanded={isSidebarExpanded}
        onToggleExpand={toggleSidebar}
      />
      
      <main className="content">
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">Admin Management</h1>
          </div>
          <div className="topbar-actions">
            <button onClick={toggleTheme} className="theme-toggle-btn" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NavLink to="/admin/registrations" className="topbar-notification">
              <Bell size={20} />
              {(registrations.data?.length > 0) && (
                <span className="notification-badge">{registrations.data.length}</span>
              )}
            </NavLink>
            {onLogout && (
              <button onClick={onLogout} className="logout-btn">
                Logout
              </button>
            )}
          </div>
        </header>
        <div className="page-container">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
