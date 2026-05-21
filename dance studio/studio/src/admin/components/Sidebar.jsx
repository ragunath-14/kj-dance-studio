import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, UserPlus, Activity } from 'lucide-react';
import { useData } from '../context/DataContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const { registrations } = useData();
  const navLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/registrations', icon: UserPlus, label: 'New Joiners', badge: registrations.length },
    { to: '/admin/students', icon: Users, label: 'Students' },
    { to: '/admin/payments', icon: CreditCard, label: 'Payments' }
  ];

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
    </aside>
  );
};

export default Sidebar;
