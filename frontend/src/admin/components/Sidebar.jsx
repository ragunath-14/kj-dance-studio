import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, UserPlus, Menu, ChevronRight } from 'lucide-react';
import { useData } from '../context/DataContext';
import logo from '../../assets/logo.png';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose, isExpanded, onToggleExpand }) => {
  const { registrations } = useData();

  const navLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/registrations', icon: UserPlus, label: 'New Joiners', badge: registrations.data?.length ?? 0 },
    { to: '/admin/students', icon: Users, label: 'Students' },
    { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="sidebar-header" onClick={onToggleExpand}>
        <div className="brand-icon-wrapper">
          <img src={logo} alt="KJ Dance Studio" className="sidebar-logo-img" />
        </div>
        <div className="logo-text">
          <h2>KJ Dance</h2>
          <p>Kutty Japan Studio</p>
        </div>
      </div>

      <nav className="nav-menu">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/admin'}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            onClick={isOpen ? onClose : undefined}
          >
            <div className="nav-item-content">
              <div className="icon-wrapper">
                <link.icon size={22} />
                {link.badge > 0 && !isExpanded && <span className="mini-badge-dot" />}
              </div>
              <span className="label-text">{link.label}</span>
            </div>
            {link.badge > 0 && isExpanded && <span className="nav-badge">{link.badge}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer" onClick={onToggleExpand}>
        <div className="menu-icon-wrapper">
          <Menu size={20} />
        </div>
        <div className="expand-hint">
          <span>Collapse Menu</span>
          <div className={`expand-arrow ${isExpanded ? 'rotated' : ''}`}>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
