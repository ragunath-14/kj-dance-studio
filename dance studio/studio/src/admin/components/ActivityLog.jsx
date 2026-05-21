import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { CreditCard, UserPlus, Clock, RefreshCcw, Activity } from 'lucide-react';
import API_URL from '../config';
import Pagination from './ui/Pagination';
import './ActivityLog.css';

const ActivityLog = () => {
  const [payments, setPayments] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filter, setFilter] = useState('all'); // all | payment | registration

  useEffect(() => {
    fetchActivity();
  }, []);

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const [payRes, regRes] = await Promise.all([
        axios.get(`${API_URL}/payments`, { params: { limit: 500 } }),
        axios.get(`${API_URL}/registrations`)
      ]);
      setPayments(payRes.data.data || payRes.data || []);
      setRegistrations(regRes.data || []);
    } catch (err) {
      console.error('ActivityLog fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Merge and sort all activities
  const allActivities = useMemo(() => {
    const paymentEntries = payments.map(p => ({
      type: 'payment',
      id: p._id,
      date: new Date(p.date || p.createdAt),
      title: p.studentId?.studentName || 'Student',
      desc: `Paid ₹${(p.amount || 0).toLocaleString()} for ${p.purpose || 'Monthly Fee'}`,
      meta: p.method || 'Cash',
      icon: 'payment',
      color: '#10b981'
    }));

    const regEntries = registrations.map(r => ({
      type: 'registration',
      id: r._id,
      date: new Date(r.createdAt),
      title: r.studentName,
      desc: `Registration for ${r.classType || 'Dance'}`,
      meta: r.status,
      icon: 'registration',
      color: r.status === 'approved' ? '#10b981' : r.status === 'rejected' ? '#ef4444' : '#3b82f6'
    }));

    let merged = [...paymentEntries, ...regEntries];
    if (filter === 'payment') merged = paymentEntries;
    if (filter === 'registration') merged = regEntries;

    return merged.sort((a, b) => b.date - a.date);
  }, [payments, registrations, filter]);

  const totalPages = Math.ceil(allActivities.length / limit);
  const paginatedActivities = allActivities.slice((page - 1) * limit, page * limit);

  const getStatusBadgeClass = (status) => {
    if (status === 'approved') return 'status-approved';
    if (status === 'rejected') return 'status-rejected';
    if (status === 'pending') return 'status-pending';
    return '';
  };

  const formatRelativeTime = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB');
  };

  return (
    <div className="activity-log animate-fade-in">
      <div className="activity-log-header">
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            <Activity size={24} style={{ verticalAlign: 'middle', marginRight: '10px', color: 'var(--primary-color)' }} />
            Activity Log
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            {allActivities.length} total events
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="activity-filter-tabs">
            <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => { setFilter('all'); setPage(1); }}>All</button>
            <button className={`filter-btn ${filter === 'payment' ? 'active' : ''}`} onClick={() => { setFilter('payment'); setPage(1); }}>Payments</button>
            <button className={`filter-btn ${filter === 'registration' ? 'active' : ''}`} onClick={() => { setFilter('registration'); setPage(1); }}>Registrations</button>
          </div>
          <button className="refresh-btn" onClick={fetchActivity} disabled={loading}>
            <RefreshCcw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="activity-timeline">
        {loading && paginatedActivities.length === 0 ? (
          <div className="loading-state">Loading activity...</div>
        ) : paginatedActivities.length > 0 ? (
          paginatedActivities.map((act, i) => (
            <div key={`${act.type}-${act.id}-${i}`} className="timeline-entry">
              <div className="timeline-dot" style={{ backgroundColor: act.color }} />
              <div className="timeline-content">
                <div className="timeline-top">
                  <div className="timeline-icon" style={{ backgroundColor: `${act.color}15`, color: act.color }}>
                    {act.type === 'payment' ? <CreditCard size={16} /> : <UserPlus size={16} />}
                  </div>
                  <div className="timeline-info">
                    <h4>{act.title}</h4>
                    <p>{act.desc}</p>
                  </div>
                  <div className="timeline-meta">
                    <span className="timeline-time">
                      <Clock size={12} /> {formatRelativeTime(act.date)}
                    </span>
                    {act.type === 'payment' ? (
                      <span className="meta-badge method">{act.meta}</span>
                    ) : (
                      <span className={`meta-badge ${getStatusBadgeClass(act.meta)}`}>{act.meta}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <Activity size={48} />
            <p>No activity found.</p>
          </div>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
      />
    </div>
  );
};

export default ActivityLog;
