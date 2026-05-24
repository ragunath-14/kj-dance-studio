import React, { useState } from 'react';
import { Menu, X, Bell } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Sidebar from './Sidebar';
import ThemeToggle from './ui/ThemeToggle';
import './Layout.css';

const Layout = ({ children, onLogout }) => {
  const { registrations } = useData();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className={`layout ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      <div className="mobile-header">
        <button className="menu-toggle" onClick={toggleMobileMenu}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1>Dance Studio</h1>
        <div className="mobile-header-actions">
          <ThemeToggle />
          <NavLink to="/admin/registrations" className="topbar-notification" style={{ padding: '6px' }}>
            <Bell size={20} />
            {registrations.length > 0 && <span className="notification-badge">{registrations.length}</span>}
          </NavLink>
          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                background: 'transparent',
                border: '1px solid #ef4444',
                color: '#ef4444',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px',
              }}>
              Logout
            </button>
          )}
        </div>
      </div>
      
      <div className={`sidebar-overlay ${isMobileMenuOpen ? 'show' : ''}`} onClick={toggleMobileMenu}></div>
      
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      <main className="content">
        <header className="topbar">
          <h1>Admin Management</h1>
          <div className="topbar-actions" style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
            <ThemeToggle />
            <NavLink to="/admin/registrations" className="topbar-notification">
              <Bell size={24} />
              {registrations.length > 0 && <span className="notification-badge">{registrations.length}</span>}
            </NavLink>
            {onLogout && (
              <button 
                onClick={onLogout} 
                style={{
                  background: 'transparent', 
                  border: '1px solid #ef4444', 
                  color: '#ef4444', 
                  padding: '6px 12px', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  fontWeight: '500'
                }}>
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
