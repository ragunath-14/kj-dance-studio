import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CreditCard, TrendingUp, AlertCircle, Calendar, Music, UserPlus, Clock } from 'lucide-react';
import { useData } from '../context/DataContext';
import Modal from './ui/Modal';
import Pagination from './Pagination';
import './Dashboard.css';

const Dashboard = () => {
  const { stats, loading, fetchActivity } = useData();
  const navigate = useNavigate();
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityData, setActivityData] = useState({ data: [], total: 0, page: 1, limit: 10 });
  const [activityLoading, setActivityLoading] = useState(false);

  const loadActivity = async (page = 1) => {
    setActivityLoading(true);
    const res = await fetchActivity(page, 10);
    setActivityData(res);
    setActivityLoading(false);
  };

  useEffect(() => {
    if (showActivityModal) {
      loadActivity(1);
    }
  }, [showActivityModal]);

  const metrics = useMemo(() => {
    if (!stats || !stats.metrics) return {
      total: 0, revenue: 0, overdue: 0, pending: 0,
      classTypes: { regular: 0, summer: 0, fitness: 0 }
    };
    return stats.metrics;
  }, [stats]);

  const recentActivity = useMemo(() => {
    if (!stats || !stats.recentActivity) return [];
    
    return stats.recentActivity.map(act => {
      if (act.type === 'payment') {
        return {
          ...act,
          title: act.studentId?.studentName || 'Student',
          desc: `Paid ₹${act.amount} for ${act.purpose}`,
          icon: <CreditCard size={14} />,
          color: '#4CAF50',
          date: new Date(act.date)
        };
      } else {
        return {
          ...act,
          title: act.studentName,
          desc: `New registration for ${act.classType}`,
          icon: <UserPlus size={14} />,
          color: '#2196F3',
          date: new Date(act.date)
        };
      }
    });
  }, [stats]);

  return (
    <div className="dashboard animate-fade-in">
      <header className="dashboard-header">
        <div className="welcome">
          <h1>Welcome back, Admin</h1>
          <p>Here's what's happening today at KJ Dance Studio.</p>
        </div>
        <div className="date-display">
          <Calendar size={18} />
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </header>

      <div className="quick-actions-bar">
        <button className="qa-btn" onClick={() => navigate('/admin/students')}>
          <UserPlus size={18} /> Add Student
        </button>
        <button className="qa-btn" onClick={() => navigate('/admin/payments')}>
          <CreditCard size={18} /> Record Payment
        </button>
        <button className="qa-btn" onClick={() => navigate('/admin/registrations')}>
          <AlertCircle size={18} /> View New Joiners
        </button>
      </div>

      <div className="stats-grid">
        <StatCard 
          label="Active Students" 
          value={metrics.total} 
          icon={<Users />} 
          color="#ED1C24" 
          trend="Total enrolled" 
          loading={loading}
        />
        <StatCard 
          label="Monthly Revenue" 
          value={`₹${(metrics.revenue || 0).toLocaleString()}`} 
          icon={<TrendingUp />} 
          color="#4CAF50" 
          trend={`${new Date().toLocaleString('default', { month: 'long' })} Collections`}
          loading={loading}
        />
        <StatCard 
          label="New Joiner Requests" 
          value={metrics.pending} 
          icon={<UserPlus />} 
          color="#2196F3" 
          trend="Pending Approvals"
          loading={loading}
        />
        <StatCard 
          label="Overdue Fees" 
          value={metrics.overdue} 
          icon={<AlertCircle />} 
          color="#F44336" 
          trend="Needs Attention"
          loading={loading}
        />
      </div>
      
      <div className="dashboard-layout">
        <div className="dashboard-main">

          <div className="card class-breakdown">
            <div className="card-header">
              <h2>Class Distribution</h2>
              <Music size={20} className="text-muted" />
            </div>
            <div className="class-pills">
              <div className="pill regular">
                <span>Regular</span>
                <div className="pill-bar-wrap">
                  <div className="pill-bar" style={{ width: `${(metrics.classTypes.regular / (metrics.total || 1)) * 100}%` }}></div>
                </div>
                <strong>{metrics.classTypes.regular}</strong>
              </div>
              <div className="pill fitness">
                <span>Fitness</span>
                <div className="pill-bar-wrap">
                  <div className="pill-bar" style={{ width: `${(metrics.classTypes.fitness / (metrics.total || 1)) * 100}%` }}></div>
                </div>
                <strong>{metrics.classTypes.fitness}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-sidebar">
          <div className="card">
            <div className="card-header">
              <h2>Activity (Last 24 Hours)</h2>
              <button 
                className="view-all-btn" 
                onClick={() => setShowActivityModal(true)}
                style={{ fontSize: '11px', background: 'var(--surface-light)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                View All
              </button>
            </div>
            <div className="activity-feed">
              {recentActivity.length > 0 ? (
                recentActivity.map((act, i) => (
                  <div key={i} className="activity-entry">
                    <div className="activity-icon" style={{ backgroundColor: `${act.color}15`, color: act.color }}>
                      {act.icon}
                    </div>
                    <div className="activity-details">
                      <h4>{act.title}</h4>
                      <p>{act.desc}</p>
                      <span className="activity-time">{new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.round((Date.now() - act.date) / (1000 * 60 * 60)), 'hour')}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="placeholder-text">No recent activity detected.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log Modal */}
      <Modal 
        isOpen={showActivityModal} 
        onClose={() => setShowActivityModal(false)} 
        title="Complete Activity Log"
        width="700px"
      >
        <div className="full-activity-log">
          {activityLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading activity records...</div>
          ) : (
            <>
              <div className="activity-list-modal">
                {(activityData.data || []).map((act, i) => (
                  <div key={i} className="modal-activity-item" style={{ display: 'flex', gap: '16px', padding: '12px', borderBottom: '1px solid var(--border)' }}>
                    <div className="act-icon" style={{ 
                      width: '32px', height: '32px', borderRadius: '8px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: act.type === 'payment' ? '#4CAF5015' : '#2196F315',
                      color: act.type === 'payment' ? '#4CAF50' : '#2196F3'
                    }}>
                      {act.type === 'payment' ? <CreditCard size={16} /> : <UserPlus size={16} />}
                    </div>
                    <div className="act-info">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <strong style={{ fontSize: '0.95rem' }}>{act.studentName}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(act.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {act.type === 'payment' ? `Payment of ₹${act.amount} for ${act.purpose}` : `New student registration for ${act.classType}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '20px' }}>
                <Pagination 
                  currentPage={activityData.page} 
                  totalItems={activityData.total} 
                  itemsPerPage={activityData.limit} 
                  onPageChange={loadActivity} 
                />
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};


const StatCard = ({ label, value, icon, color, trend, loading }) => (
  <div className="stat-card">
    <div className="stat-card-inner">
      <div className="stat-icon-wrap" style={{ backgroundColor: `${color}15`, color: color }}>
        {icon}
      </div>
      <div className="stat-content">
        <p className="stat-label">{label}</p>
        <h3 className="stat-value">{loading ? '...' : value}</h3>
        {trend && <span className="stat-trend" style={{ color: color }}>{trend}</span>}
      </div>
    </div>
  </div>
);

export default Dashboard;
