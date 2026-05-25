import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, UserPlus, Activity, LogOut } from 'lucide-react';
import { useData } from '../context/DataContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose, onLogout }) => {
  const { registrations } = useData();
  const navLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/registrations', icon: UserPlus, label: 'New Joiners', badge: registrations.length },
    { to: '/admin/students', icon: Users, label: 'Students' },
    { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
    { to: '/admin/activity', icon: Activity, label: 'Activity Log' },
  ];

  const handleLogout = () => {
    onClose();
    if (onLogout) onLogout();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="logo-container">
        <h2>Expression</h2>
        <p>Dance Studio Admin</p>
      </div>
      <nav className="nav-menu">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/admin'}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            onClick={onClose}
          >
            <div className="nav-item-content">
              <link.icon size={20} />
              <span>{link.label}</span>
            </div>
            {link.badge > 0 && <span className="nav-badge">{link.badge}</span>}
          </NavLink>
        ))}
      </nav>

      {/* ── Logout at the bottom of sidebar ── */}
      <div className="sidebar-footer">
        {onLogout && (
          <button className="nav-item logout sidebar-logout-btn" onClick={handleLogout}>
            <div className="nav-item-content">
              <LogOut size={20} />
              <span>Logout</span>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
