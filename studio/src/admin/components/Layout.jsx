import React, { useState, useEffect } from 'react';
import { Menu, X, Bell } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Sidebar from './Sidebar';
import ThemeToggle from './ui/ThemeToggle';
import './Layout.css';

const MOBILE_BREAKPOINT = 768;

const Layout = ({ children, onLogout }) => {
  const { registrations } = useData();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

  // Track resize to toggle mobile mode
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setIsMobileMenuOpen(false); // close menu if going to desktop
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
<<<<<<< HEAD
    <div className="layout">
      {/* ── Mobile Header (only shown on mobile) ── */}
      {isMobile && (
        <div className="mobile-header">
          <div className="mobile-header-left">
            <button
              className="menu-toggle"
              onClick={toggleMobileMenu}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1>Expressionz Studio</h1>
=======
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
>>>>>>> c792a713bdff3a9356a754f3d0ec17c2da4bc73a
          </div>
          <div className="mobile-header-right">
            <ThemeToggle />
            <NavLink to="/admin/registrations" className="topbar-notification" style={{ padding: '6px' }}>
              <Bell size={20} />
              {registrations.length > 0 && (
                <span className="notification-badge">{registrations.length}</span>
              )}
            </NavLink>
          </div>
        </div>
      )}

      {/* ── Backdrop overlay when sidebar is open on mobile ── */}
      {isMobile && isMobileMenuOpen && (
        <div className="sidebar-overlay show" onClick={closeMobileMenu} />
      )}

      {/* ── Sidebar ── */}
      <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />

      {/* ── Main Content ── */}
      <main
        className="content"
        style={isMobile ? { marginLeft: 0, width: '100%' } : {}}
      >
        {/* Desktop topbar */}
        {!isMobile && (
          <header className="topbar">
            <h1>Admin Panel</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <ThemeToggle />
              <NavLink to="/admin/registrations" className="topbar-notification">
                <Bell size={22} />
                {registrations.length > 0 && (
                  <span className="notification-badge">{registrations.length}</span>
                )}
              </NavLink>
              {onLogout && (
                <button
                  onClick={onLogout}
                  style={{
                    background: 'transparent',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                  }}
                >
                  Logout
                </button>
              )}
            </div>
          </header>
        )}

        <div className="page-container">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
