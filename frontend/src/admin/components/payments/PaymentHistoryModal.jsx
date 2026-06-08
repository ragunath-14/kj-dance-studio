import React from 'react';
import { createPortal } from 'react-dom';
import { X, CreditCard, Calendar, TrendingDown } from 'lucide-react';
import axios from 'axios';
import API_URL from '../../config';
import Button from '../ui/Button';

const PaymentHistoryModal = ({ student, onClose }) => {
  const [studentPayments, setStudentPayments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!student) return;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/payments/student/${student._id}`);
        setStudentPayments(res.data);
      } catch (err) {
        console.error('History fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [student]);

  if (!student) return null;

  const getMonthlyFee = (student) => {
    if (student?.classType === 'Fitness Class') return 2000;
    return student?.studentCategory === 'Kids' ? 1000 : 1300;
  };
  const today = new Date();

  const joinDate = new Date(student.createdAt || student.joinDate || today);
  let totalCycles = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth()) + 1;
  if (today.getDate() < joinDate.getDate()) totalCycles--;
  if (totalCycles < 0) totalCycles = 0;

  const fee = getMonthlyFee(student);
  const totalPaid = studentPayments
    .filter(p => p.purpose === 'Monthly Fee' && new Date(p.date) >= joinDate)
    .reduce((s, p) => s + (p.amount || 0), 0);
  const totalExpected = totalCycles * fee;
  const totalDue = Math.max(0, totalExpected - totalPaid);

  return createPortal(
    <div className="history-overlay" onClick={onClose}>
      <div className="history-modal" onClick={e => e.stopPropagation()}>
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

        <div className="history-summary">
          <div className="hs-card green">
            <div className="hs-icon-wrap">
              <CreditCard size={18} />
            </div>
            <div>
              <span>Total Paid</span>
              <strong>₹{totalPaid.toLocaleString()}</strong>
            </div>
          </div>
          <div className="hs-card orange">
            <div className="hs-icon-wrap">
              <Calendar size={18} />
            </div>
            <div>
              <span>Months Billed</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <strong>{totalCycles}</strong>
                <small style={{ fontSize: '10px', opacity: 0.8 }}>({totalCycles} × ₹{fee})</small>
              </div>
            </div>
          </div>
          <div className={`hs-card ${totalDue > 0 ? 'red' : 'green'}`}>
            <div className="hs-icon-wrap">
              <TrendingDown size={18} />
            </div>
            <div>
              <span>Pending Dues</span>
              <strong>{totalDue > 0 ? `₹${totalDue.toLocaleString()}` : 'Clear ✓'}</strong>
            </div>
          </div>
        </div>

        <div className="history-table-wrap">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading history...</div>
          ) : (
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
              {studentPayments.length > 0 ? studentPayments.map((p, i) => (
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
          )}
        </div>

        <div className="history-footer">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaymentHistoryModal;
