import React from 'react';
import { X, CreditCard, Calendar, TrendingDown } from 'lucide-react';
import Button from '../ui/Button';

const PaymentHistoryModal = ({ student, payments, onClose, onRecordPayment }) => {
  if (!student) return null;

  const getMonthlyFee = (ct) => ct === 'Fitness Class' ? 2500 : 3500;
  const today = new Date();
  const studentIdStr = student._id?.toString();

  const studentPayments = (payments.data || [])
    .filter(p => {
      const pid = p.studentId?._id?.toString() || p.studentId?.toString();
      return pid === studentIdStr;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const joinDate = new Date(student.createdAt || student.joinDate || today);
  let totalCycles = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth()) + 1;
  if (today.getDate() < joinDate.getDate()) totalCycles--;
  if (totalCycles < 0) totalCycles = 0;

  const fee = getMonthlyFee(student.classType);
  const totalPaid = studentPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalExpected = totalCycles * fee;
  const totalDue = Math.max(0, totalExpected - totalPaid);

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-modal" onClick={e => e.stopPropagation()}>
        <div className="history-header">
          <div>
            <h2>{student.studentName || student.name}</h2>
            <p>{student.classType} · Joined {joinDate.toLocaleDateString('en-GB')}</p>
          </div>
          <button className="history-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="history-summary">
          <div className="hs-card green">
            <CreditCard size={18} />
            <div>
              <span>Total Paid</span>
              <strong>₹{totalPaid.toLocaleString()}</strong>
            </div>
          </div>
          <div className="hs-card orange">
            <Calendar size={18} />
            <div>
              <span>Months Billed</span>
              <strong>{totalCycles} month{totalCycles !== 1 ? 's' : ''} × ₹{fee}</strong>
            </div>
          </div>
          <div className={`hs-card ${totalDue > 0 ? 'red' : 'green'}`}>
            <TrendingDown size={18} />
            <div>
              <span>Pending Dues</span>
              <strong>{totalDue > 0 ? `₹${totalDue.toLocaleString()}` : 'Clear ✓'}</strong>
            </div>
          </div>
        </div>

        <div className="history-table-wrap">
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
                  <td style={{ color: '#4CAF50', fontWeight: 700 }}>₹{p.amount.toLocaleString()}</td>
                  <td>{p.method || '—'}</td>
                  <td>{p.purpose || '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="text-center" style={{ padding: '24px', color: 'var(--text-muted)' }}>No payment records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="history-footer">
          <Button variant="primary" onClick={() => { onClose(); onRecordPayment(student); }}>Record Payment</Button>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryModal;
