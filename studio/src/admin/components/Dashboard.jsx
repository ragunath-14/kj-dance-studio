import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { NavLink } from 'react-router-dom';
import {
  Users, CreditCard, TrendingUp, AlertCircle,
  Calendar, Music, UserPlus, Send,
  ChevronDown, ChevronUp, Phone
} from 'lucide-react';
import { useData } from '../context/DataContext';
import API_URL from '../config';
import './Dashboard.css';

const Dashboard = () => {
  const { stats, loading, statsLoading } = useData();
  const [now, setNow] = useState(() => Date.now());
  const [overdueOpen, setOverdueOpen] = useState(false);
  // Per-student reminder state: { [studentId]: 'idle' | 'sending' | 'sent' | 'error' }
  const [reminderState, setReminderState] = useState({});

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const isLoading = loading || statsLoading;

  const metrics = useMemo(() => {
    if (!stats?.metrics) return {
      total: 0, revenue: 0, lifetime: 0, overdue: 0, pending: 0,
      classTypes: { dance: 0, regular: 0, fitness: 0 }
    };
    return stats.metrics;
  }, [stats]);

  const overdueStudents = useMemo(() => stats?.overdueStudents || [], [stats]);

  const recentActivity = useMemo(() => {
    if (!stats?.recentActivity) return [];
    return stats.recentActivity.map(act => {
      if (act.type === 'payment') {
        return {
          ...act,
          title: act.studentId?.studentName || 'Student',
          desc: `Paid ₹${act.amount?.toLocaleString()} for ${act.purpose}`,
          icon: <CreditCard size={14} />,
          color: '#4CAF50',
          date: new Date(act.date)
        };
      }
      return {
        ...act,
        title: act.studentName,
        desc: `New registration for ${act.classType}`,
        icon: <UserPlus size={14} />,
        color: '#2196F3',
        date: new Date(act.date)
      };
    });
  }, [stats]);

  const sendReminder = async (student) => {
    setReminderState(s => ({ ...s, [student._id]: 'sending' }));
    try {
      const res = await axios.post(`${API_URL}/payments/send-reminder/${student._id}`);
      setReminderState(s => ({
        ...s,
        [student._id]: res.data.success ? 'sent' : 'error'
      }));
      // Reset to idle after 4 seconds
      setTimeout(() => {
        setReminderState(s => ({ ...s, [student._id]: 'idle' }));
      }, 4000);
    } catch {
      setReminderState(s => ({ ...s, [student._id]: 'error' }));
      setTimeout(() => {
        setReminderState(s => ({ ...s, [student._id]: 'idle' }));
      }, 4000);
    }
  };

  const relativeTime = (date) => {
    const diffMs = now - date;
    const diffH  = Math.round(diffMs / (1000 * 60 * 60));
    const diffM  = Math.round(diffMs / (1000 * 60));
    if (diffM < 60) return `${diffM}m ago`;
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.round(diffH / 24)}d ago`;
  };

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

      {/* ── Stats Grid ───────────────────────────────────────────────────── */}
      <div className="stats-grid">
        <StatCard label="Active Students"   value={metrics.total}                                              icon={<Users />}       color="#FF8C00" trend="Total enrolled"    loading={isLoading} />
        <StatCard label="Monthly Revenue"   value={`₹${(metrics.revenue || 0).toLocaleString()}`}              icon={<TrendingUp />}  color="#4CAF50" trend={`${new Date().toLocaleString('default', { month: 'long' })} Collections`} loading={isLoading} />
        <StatCard label="Pending Approvals" value={metrics.pending}                                            icon={<UserPlus />}    color="#2196F3" trend="New Enquiries"     loading={isLoading} />
        <StatCard label="Overdue Fees"      value={metrics.overdue}                                            icon={<AlertCircle />} color="#F44336" trend="Needs Attention"   loading={isLoading} />
      </div>

      {/* ── Overdue Students Panel ───────────────────────────────────────── */}
      {overdueStudents.length > 0 && (
        <div className="overdue-panel">
          <button
            className="overdue-panel-toggle"
            onClick={() => setOverdueOpen(o => !o)}
          >
            <span className="overdue-toggle-left">
              <AlertCircle size={18} style={{ color: '#F44336' }} />
              <strong>{overdueStudents.length} student{overdueStudents.length > 1 ? 's' : ''} with overdue fees</strong>
              <span className="overdue-total-badge">
                ₹{overdueStudents.reduce((s, x) => s + x.totalDue, 0).toLocaleString()} total
              </span>
            </span>
            {overdueOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {overdueOpen && (
            <div className="overdue-list">
              {overdueStudents.map(student => {
                const state = reminderState[student._id] || 'idle';
                const lastAlertDate = student.lastAlertSent
                  ? new Date(student.lastAlertSent).toLocaleDateString('en-IN')
                  : 'Never';
                return (
                  <div key={student._id} className="overdue-row">
                    <div className="overdue-student-info">
                      <span className="overdue-name">{student.studentName}</span>
                      <span className="overdue-class">{student.classType}</span>
                    </div>
                    <div className="overdue-contact">
                      <Phone size={12} />
                      {student.whatsappNumber || student.phone || '—'}
                    </div>
                    <div className="overdue-badges">
                      <span className="overdue-months-badge">
                        {student.pendingMonths} month{student.pendingMonths > 1 ? 's' : ''}
                      </span>
                      <span className="overdue-amount">₹{student.totalDue.toLocaleString()}</span>
                    </div>
                    <div className="overdue-last-alert">
                      Last notified: {lastAlertDate}
                    </div>
                    <button
                      className={`reminder-btn reminder-btn--${state}`}
                      onClick={() => sendReminder(student)}
                      disabled={state === 'sending' || state === 'sent'}
                      title="Send WhatsApp reminder"
                    >
                      {state === 'sending' && <span className="btn-spinner" />}
                      {state === 'idle'    && <><Send size={13} /> Remind</>}
                      {state === 'sent'    && '✅ Sent'}
                      {state === 'error'   && '❌ Failed'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Main Layout ──────────────────────────────────────────────────── */}
      <div className="dashboard-layout">
        <div className="dashboard-main">
          <div className="card class-breakdown">
            <div className="card-header">
              <h2>Class Distribution</h2>
              <Music size={20} className="text-muted" />
            </div>
            <div className="class-pills">
              <ClassPill label="Dance"   count={metrics.classTypes.dance}   total={metrics.total || 1} className="dance"   />
              <ClassPill label="Fitness" count={metrics.classTypes.fitness} total={metrics.total || 1} className="fitness" />
            </div>
          </div>
        </div>

        <div className="dashboard-sidebar">
          <div className="card">
            <div className="card-header">
              <h2>Last 24h Activity</h2>
              <NavLink to="/admin/activity" style={{ fontSize: '13px', color: 'var(--primary-color)', fontWeight: 700, textDecoration: 'none' }}>View All →</NavLink>
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
                      <span className="activity-time">{relativeTime(act.date)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="activity-empty">
                  <div className="activity-empty-icon">📊</div>
                  <p>No activity in the last 24 hours.</p>
                  <NavLink to="/admin/activity" className="activity-history-link">View full history →</NavLink>
                </div>
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
      <div className="stat-icon-wrap" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </div>
      <div className="stat-content">
        <p className="stat-label">{label}</p>
        <h3 className="stat-value">
          {loading ? <span className="skeleton-value" /> : value}
        </h3>
        {trend && <span className="stat-trend" style={{ color }}>{trend}</span>}
      </div>
    </div>
  </div>
);

const ClassPill = ({ label, count, total, className }) => (
  <div className={`pill ${className}`}>
    <span>{label}</span>
    <div className="pill-bar-wrap">
      <div className="pill-bar" style={{ width: `${(count / total) * 100}%` }} />
    </div>
    <strong>{count}</strong>
  </div>
);

export default Dashboard;
