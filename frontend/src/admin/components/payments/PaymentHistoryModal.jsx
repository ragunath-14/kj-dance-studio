import React from 'react';
import { createPortal } from 'react-dom';
import { X, CreditCard, Calendar, TrendingDown, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import axios from 'axios';
import API_URL from '../../config';
import Button from '../ui/Button';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const StatusBadge = ({ status, paid, fee }) => {
  const configs = {
    paid:    { label: 'Paid',    bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', icon: <CheckCircle  size={12} /> },
    partial: { label: `Partial (₹${paid?.toLocaleString()} / ₹${fee?.toLocaleString()})`, bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', icon: <Clock        size={12} /> },
    pending: { label: 'Pending', bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', icon: <AlertCircle  size={12} /> },
  };
  const cfg = configs[status] || configs.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: 700, padding: '3px 8px',
      borderRadius: '20px', background: cfg.bg, color: cfg.color
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

const PaymentHistoryModal = ({ student, onClose, onRecordPayment }) => {
  const [data, setData]       = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!student) return;
    setLoading(true);
    setData(null);
    axios.get(`${API_URL}/payments/student/${student._id}`)
      .then(res => setData(res.data))
      .catch(err => console.error('History fetch failed:', err))
      .finally(() => setLoading(false));
  }, [student]);

  if (!student) return null;

  const { payments = [], monthHistory = [], student: meta = {} } = data || {};

  // Summary totals
  const totalPaid     = payments.filter(p => p.purpose === 'Monthly Fee').reduce((s, p) => s + (p.amount || 0), 0);
  // each month carries the fee (and offer) that applied to it
  const totalExpected = monthHistory.reduce((sum, m) => sum + (m.fee || 0), 0);
  const totalDue      = Math.max(0, totalExpected - totalPaid);

  const joinDate = new Date(student.createdAt || student.joinDate || new Date());

  return createPortal(
    <div className="history-overlay" onClick={onClose}>
      <div className="history-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', width: '95vw' }}>
        <div className="history-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h2>{student.studentName || student.name}</h2>
              <span style={{ fontSize: '10px', background: 'var(--primary-red)', color: 'white', padding: '2px 8px', borderRadius: '40px', fontWeight: 900, textTransform: 'uppercase' }}>History</span>
            </div>
            <p>{student.classType} · Joined {joinDate.toLocaleDateString('en-GB')}</p>
          </div>
          <button className="history-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Summary cards */}
        <div className="history-summary">
          <div className="hs-card green">
            <div className="hs-icon-wrap"><CreditCard size={18} /></div>
            <div>
              <span>Total Paid</span>
              <strong>₹{totalPaid.toLocaleString()}</strong>
            </div>
          </div>
          <div className="hs-card orange">
            <div className="hs-icon-wrap"><Calendar size={18} /></div>
            <div>
              <span>Months Billed</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <strong>{monthHistory.length}</strong>
                <small style={{ fontSize: '10px', opacity: 0.8 }}>(₹{totalExpected.toLocaleString()} billed)</small>
              </div>
            </div>
          </div>
          <div className={`hs-card ${totalDue > 0 ? 'red' : 'green'}`}>
            <div className="hs-icon-wrap"><TrendingDown size={18} /></div>
            <div>
              <span>Pending Dues</span>
              <strong>{totalDue > 0 ? `₹${totalDue.toLocaleString()}` : 'Clear ✓'}</strong>
            </div>
          </div>
        </div>

        {/* Month-by-month breakdown */}
        <div className="history-table-wrap">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading history...</div>
          ) : monthHistory.length > 0 ? (
            <>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', padding: '0 2px' }}>
                Monthly Payment Timeline
              </div>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Fee</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthHistory.map((m, i) => (
                    <tr key={i} style={{
                      background: m.status === 'pending' && i === 0
                        ? 'rgba(239,68,68,0.04)'
                        : m.status === 'partial'
                          ? 'rgba(245,158,11,0.04)'
                          : 'transparent'
                    }}>
                      <td style={{ fontWeight: i === 0 ? 700 : 400 }}>
                        {m.label}
                        {i === 0 && <span style={{ marginLeft: '6px', fontSize: '9px', background: 'var(--primary-red)', color: '#fff', padding: '1px 5px', borderRadius: '10px' }}>Current</span>}
                      </td>
                      <td>₹{m.fee?.toLocaleString()}</td>
                      <td style={{ color: m.paid > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: m.paid > 0 ? 700 : 400 }}>
                        {m.paid > 0 ? `₹${m.paid.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ color: m.due > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                        {m.due > 0 ? `₹${m.due.toLocaleString()}` : '—'}
                      </td>
                      <td><StatusBadge status={m.status} paid={m.paid} fee={m.fee} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <>
              {/* Fallback: raw payment list if no monthHistory (legacy payments without forMonth) */}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', padding: '0 2px' }}>
                Payment Records
              </div>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length > 0 ? payments.map((p, i) => (
                    <tr key={i}>
                      <td>{new Date(p.date).toLocaleDateString('en-GB')}</td>
                      <td className="amount-col">₹{p.amount.toLocaleString()}</td>
                      <td>{p.method || '—'}</td>
                      <td>{p.purpose || '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" className="text-center" style={{ padding: '24px', color: 'var(--text-muted)' }}>No payment records found.</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="history-footer">
          {onRecordPayment && totalDue > 0 && (
            <Button variant="primary" onClick={() => { onRecordPayment(student); onClose(); }}>
              Record Payment
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaymentHistoryModal;
