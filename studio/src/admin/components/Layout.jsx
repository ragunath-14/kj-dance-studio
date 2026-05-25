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
      <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} onLogout={onLogout} />

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
