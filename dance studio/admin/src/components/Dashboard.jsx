import React, { useMemo, useState, useEffect } from 'react';
import { Users, CreditCard, TrendingUp, AlertCircle, CheckCircle, Calendar, Music, UserPlus } from 'lucide-react';
import { useData } from '../context/DataContext';
import './Dashboard.css';

const Dashboard = () => {
  const { stats, loading } = useData();
  // eslint-disable-next-line react-hooks/purity
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const metrics = useMemo(() => {
    if (!stats || !stats.metrics) return {
      total: 0, revenue: 0, lifetime: 0, overdue: 0, pending: 0,
      classTypes: { dance: 0, regular: 0, fitness: 0 }
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
          <p>Here's what's happening today at Expressionz Dance Academy.</p>
        </div>
        <div className="date-display">
          <Calendar size={18} />
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </header>

      <div className="stats-grid">
        <StatCard 
          label="Active Students" 
          value={metrics.total} 
          icon={<Users />} 
          color="#FF8C00" 
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
          label="Pending Approvals" 
          value={metrics.pending} 
          icon={<UserPlus />} 
          color="#2196F3" 
          trend="New Enquiries"
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
              <div className="pill dance">
                <span>Dance</span>
                <div className="pill-bar-wrap">
                  <div className="pill-bar" style={{ width: `${(metrics.classTypes.dance / (metrics.total || 1)) * 100}%` }}></div>
                </div>
                <strong>{metrics.classTypes.dance}</strong>
              </div>
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
              <TrendingUp size={20} className="text-muted" />
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
                      <span className="activity-time">{new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.round((now - act.date) / (1000 * 60 * 60)), 'hour')}</span>
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
