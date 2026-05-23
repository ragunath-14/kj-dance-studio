import React, { useState, useMemo } from 'react';
import Button from '../ui/Button';
import { Search, User, CreditCard, TrendingDown, CheckCircle } from 'lucide-react';

const PaymentForm = ({ formData, setFormData, students, payments = [], currentDebt, isEditing, editingPaymentAmount = 0, onSubmit, onCancel }) => {
  const initialStudentName = useMemo(() => {
    if (!formData.studentId) return '';
    const student = students.find(s => s._id === formData.studentId);
    return student ? (student.studentName || student.name) : '';
  }, [formData.studentId, students]);

  const [studentSearch, setStudentSearch] = useState(initialStudentName);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Update search box when student selection changes (e.g. when opening edit modal)
  React.useEffect(() => {
    setStudentSearch(initialStudentName);
  }, [initialStudentName]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return [];
    const term = studentSearch.toLowerCase();
    return students.filter(s =>
      s.isActive !== false &&
      ((s.studentName || '').toLowerCase().includes(term) ||
      (s.email || '').toLowerCase().includes(term) ||
      (s.phone || '').toLowerCase().includes(term) ||
      (s.danceStyle || '').toLowerCase().includes(term))
    ).slice(0, 5); // Limit to 5 suggestions
  }, [students, studentSearch]);

  const handleSelectStudent = (student) => {
    setFormData({ ...formData, studentId: student._id });
    setStudentSearch(student.studentName);
    setShowSuggestions(false);
  };

  const studentPayments = useMemo(() => {
    if (!formData.studentId || !payments) return [];
    return payments
      .filter(p => (p.studentId?._id || p.studentId) === formData.studentId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5); // Show latest 5 transactions
  }, [formData.studentId, payments]);

  // ── Dynamic dues calculation (adds back payment-under-edit per blueprint) ──
  const selectedStudent = useMemo(() => {
    return students.find(s => s._id === formData.studentId);
  }, [formData.studentId, students]);

  const duesInfo = useMemo(() => {
    if (!selectedStudent) return null;
    const today = new Date();
    const getMonthlyFee = (ct) => ct === 'Fitness Class' ? 2500 : 3500;
    const joinDate = new Date(selectedStudent.createdAt || selectedStudent.joinDate || today);
    let totalCycles = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth()) + 1;
    if (today.getDate() < joinDate.getDate()) totalCycles--;
    if (totalCycles <= 0) totalCycles = 0;

    const fee = getMonthlyFee(selectedStudent.classType);

    // Prefer server-side totalPaid (already aggregated from full payment history)
    // Fall back to filtering the paginated payments prop (less accurate but better than nothing)
    let totalPaid = selectedStudent.totalPaid ?? null;
    if (totalPaid === null) {
      const studentFeePayments = payments.filter(p => {
        const pid = p.studentId?._id || p.studentId;
        return pid === selectedStudent._id && p.purpose === 'Monthly Fee';
      });
      totalPaid = studentFeePayments.reduce((s, p) => s + (p.amount || 0), 0);
    }

    // When editing, add back the original payment amount to get accurate balance
    if (isEditing && editingPaymentAmount > 0) {
      totalPaid -= editingPaymentAmount;
    }

    const totalExpected = totalCycles * fee;
    const totalDue = Math.max(0, totalExpected - totalPaid);
    return { totalPaid, totalExpected, totalDue, fee, totalCycles };
  }, [selectedStudent, payments, isEditing, editingPaymentAmount]);

  // ── Progress bar calculation ──
  const progressInfo = useMemo(() => {
    if (!duesInfo) return null;
    const effectiveDebt = currentDebt > 0 ? currentDebt : (duesInfo.totalDue || 0);
    const payingAmount = Number(formData.amount) || 0;
    const remaining = Math.max(0, effectiveDebt - payingAmount);
    const progressPercent = effectiveDebt > 0 ? Math.min(100, (payingAmount / effectiveDebt) * 100) : 0;
    return { effectiveDebt, payingAmount, remaining, progressPercent };
  }, [duesInfo, currentDebt, formData.amount]);

  return (
    <form onSubmit={onSubmit} onClick={() => setShowSuggestions(false)} className="modern-payment-form">
      <div className="pf-group" onClick={(e) => e.stopPropagation()}>
        <label className="pf-label">Student Search</label>
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text"
            placeholder="Type student name, email, or phone..."
            value={studentSearch}
            onChange={(e) => {
              setStudentSearch(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            required={!formData.studentId}
          />
        </div>
        
        {showSuggestions && filteredStudents.length > 0 && (
          <div className="suggestions-dropdown">
            {filteredStudents.map(s => (
              <div 
                key={s._id} 
                className={`suggestion-item ${formData.studentId === s._id ? 'selected' : ''}`}
                onClick={() => handleSelectStudent(s)}
              >
                <div className="suggestion-icon"><User size={14} /></div>
                <div className="suggestion-details">
                  <span className="name">{s.studentName}</span>
                  <span className="meta">{s.danceStyle} • {s.classType}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {formData.studentId && !showSuggestions && (
          <div className="selected-student-card animate-fade-in">
            <div className="card-icon"><User size={18} /></div>
            <div className="card-info">
              <div className="name-row">
                <strong>{selectedStudent?.studentName}</strong>
                <span className="badge">{selectedStudent?.classType}</span>
              </div>
              <div className="meta-row">
                <span>{selectedStudent?.danceStyle}</span>
                <span>•</span>
                <span>{selectedStudent?.email}</span>
              </div>
            </div>
            <button type="button" className="clear-selection" onClick={() => {
              setFormData({...formData, studentId: ''});
              setStudentSearch('');
            }}>Change</button>
          </div>
        )}
        
        {formData.studentId && studentPayments.length > 0 && !showSuggestions && (
          <div className="recent-history-container animate-fade-in">
            <h4>Recent Payment History</h4>
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
                  {studentPayments.map((p, i) => (
                    <tr key={i}>
                      <td>{new Date(p.date).toLocaleDateString('en-GB')}</td>
                      <td className="amount-col">₹{p.amount?.toLocaleString()}</td>
                      <td>{p.method || '—'}</td>
                      <td>{p.purpose || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="form-row-custom">
        <div className="pf-group">
          <label className="pf-label">Amount (₹)</label>
          <input 
            type="number" 
            value={formData.amount} 
            onChange={(e) => {
              const amount = Number(e.target.value);
              const debt = currentDebt > 0 ? currentDebt : (duesInfo?.totalDue || 0);
              const remaining = Math.max(0, debt - amount);
              setFormData({ ...formData, amount: e.target.value, remainingFees: remaining });
            }} 
            placeholder="0"
            required 
          />
        </div>
        <div className="pf-group">
          <label className="pf-label">Payment Date</label>
          <input 
            type="date" 
            value={formData.date ? formData.date.split('T')[0] : new Date().toISOString().split('T')[0]} 
            onChange={(e) => setFormData({...formData, date: e.target.value})} 
          />
        </div>
      </div>

      {/* ── Payment Summary Card with Progress Bar ── */}
      {formData.studentId && progressInfo && progressInfo.effectiveDebt > 0 && (
        <div className="payment-summary-card animate-fade-in">
          <div className="summary-card-header">
            <h4>
              <CreditCard size={16} />
              Payment Summary
            </h4>
            {progressInfo.remaining === 0 && progressInfo.payingAmount > 0 && (
              <span className="full-payment-badge">
                <CheckCircle size={14} /> Full Payment
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="summary-progress-bar">
            <div 
              className="summary-progress-fill" 
              style={{ width: `${progressInfo.progressPercent}%` }}
            />
          </div>

          {/* Summary Stats */}
          <div className="summary-stats-grid">
            <div className="stat-box">
              <span className="stat-label">Total Due</span>
              <span className="stat-val total-due">₹{progressInfo.effectiveDebt.toLocaleString()}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Paying Now</span>
              <span className="stat-val paying-now">₹{(progressInfo.payingAmount || 0).toLocaleString()}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Remaining</span>
              <span className={`stat-val remaining ${progressInfo.remaining > 0 ? 'pending' : 'cleared'}`}>
                {progressInfo.remaining > 0 ? `₹${progressInfo.remaining.toLocaleString()}` : 'Clear ✓'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="form-row-custom">
        <div className="pf-group">
          <label className="pf-label">Payment Method</label>
          <select 
            value={formData.method} 
            onChange={(e) => setFormData({...formData, method: e.target.value})}
          >
            <option value="Cash">Cash</option>
            <option value="Online">Online</option>
            <option value="Card">Card</option>
            <option value="UPI">UPI</option>
          </select>
        </div>
        <div className="pf-group">
          <label className="pf-label">Purpose</label>
          <select 
            value={formData.purpose} 
            onChange={(e) => setFormData({...formData, purpose: e.target.value})}
          >
            <option value="Monthly Fee">Monthly Fee</option>
            <option value="Registration">Registration</option>
            <option value="Uniform">Uniform</option>
            <option value="Workshop">Workshop</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="form-actions-row">
        <button type="button" className="btn-secondary-custom" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary-custom">
          Save Payment
        </button>
      </div>

      {/* Styled css overrides specifically for beautiful visuals in standard Modal */}
      <style>{`
        /* Global Modal Structure Overrides for High-End Glassmorphism */
        .modal {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.97) 0%, rgba(15, 23, 42, 0.99) 100%) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 0, 0, 0.3) !important;
          border-radius: 24px !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          overflow: hidden !important;
        }
        
        .modal-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          padding: 24px 32px !important;
          background: rgba(15, 23, 42, 0.2) !important;
        }

        .modal-header h2 {
          color: #ffffff !important;
          font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
          font-weight: 850 !important;
          font-size: 1.45rem !important;
          letter-spacing: -0.025em !important;
          background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          margin: 0 !important;
        }

        .btn-close {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 12px !important;
          width: 38px !important;
          height: 38px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #94a3b8 !important; /* slate-400 */
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          cursor: pointer !important;
        }

        .btn-close:hover {
          background: rgba(239, 68, 68, 0.1) !important;
          color: #f87171 !important;
          border-color: rgba(239, 68, 68, 0.2) !important;
          transform: rotate(90deg) !important;
        }

        .modal-content {
          padding: 28px 36px !important;
          background: transparent !important;
        }

        /* Form Layout Styles */
        .modern-payment-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
          color: #f8fafc !important;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .pf-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
        }

        .pf-label {
          font-size: 0.8rem !important;
          font-weight: 700 !important;
          color: #94a3b8 !important; /* slate-400 */
          margin-bottom: 2px !important;
          letter-spacing: 0.03em !important;
          text-transform: uppercase !important;
        }

        .form-row-custom {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        /* Inputs & Selectors */
        .modern-payment-form input,
        .modern-payment-form select {
          background: rgba(30, 41, 59, 0.45) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #f8fafc !important;
          padding: 12px 16px !important;
          border-radius: 12px !important;
          font-size: 0.9rem !important;
          outline: none !important;
          width: 100% !important;
          box-sizing: border-box !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2) !important;
          font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
        }

        .modern-payment-form input::placeholder {
          color: #64748b !important;
        }

        .modern-payment-form input:hover,
        .modern-payment-form select:hover {
          border-color: rgba(255, 255, 255, 0.15) !important;
          background: rgba(30, 41, 59, 0.6) !important;
        }

        .modern-payment-form input:focus,
        .modern-payment-form select:focus {
          border-color: #ff8c00 !important;
          background: rgba(30, 41, 59, 0.8) !important;
          box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2), inset 0 2px 4px rgba(0, 0, 0, 0.1) !important;
        }

        .modern-payment-form select option {
          background-color: #0f172a !important; /* Slate 900 drop option */
          color: #f8fafc !important;
          padding: 12px !important;
        }

        /* Search input specific */
        .search-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-input-wrapper input {
          padding-left: 44px !important;
        }

        .search-input-wrapper .search-icon {
          position: absolute;
          left: 16px;
          color: #64748b;
          pointer-events: none;
          transition: color 0.25s ease;
        }

        .search-input-wrapper input:focus + .search-icon {
          color: #ff8c00;
        }

        /* Search Suggestions Dropdown */
        .suggestions-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.99) 100%) !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 12px !important;
          z-index: 1000;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5) !important;
          max-height: 220px;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 6px !important;
          backdrop-filter: blur(12px);
        }

        .suggestion-item {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 10px 14px !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          background: transparent !important;
        }

        .suggestion-item:hover {
          background: rgba(255, 255, 255, 0.05) !important;
        }

        .suggestion-item.selected {
          background: rgba(251, 146, 60, 0.1) !important;
        }

        .suggestion-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #cbd5e1;
        }

        .suggestion-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .suggestion-details .name {
          font-size: 0.88rem;
          font-weight: 700;
          color: #ffffff;
        }

        .suggestion-details .meta {
          font-size: 0.75rem;
          color: #64748b;
        }

        /* Selected Student Card styling */
        .selected-student-card {
          display: flex !important;
          align-items: center !important;
          gap: 14px !important;
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 16px !important;
          padding: 16px 20px !important;
          margin-top: 4px;
        }

        .selected-student-card .card-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(251, 146, 60, 0.1);
          color: #ff8c00;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(251, 146, 60, 0.15);
        }

        .selected-student-card .card-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .selected-student-card .name-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .selected-student-card .name-row strong {
          color: #ffffff;
          font-size: 0.95rem;
          font-weight: 800;
        }

        .selected-student-card .badge {
          background: rgba(251, 146, 60, 0.12) !important;
          color: #ff8c00 !important;
          font-size: 0.72rem !important;
          font-weight: 750 !important;
          padding: 3px 8px !important;
          border-radius: 6px !important;
          border: 1px solid rgba(251, 146, 60, 0.2) !important;
        }

        .selected-student-card .meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          color: #64748b;
        }

        .selected-student-card .clear-selection {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #cbd5e1 !important;
          padding: 6px 14px !important;
          border-radius: 8px !important;
          font-size: 0.78rem !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          transition: all 0.25s ease !important;
        }

        .selected-student-card .clear-selection:hover {
          background: rgba(239, 68, 68, 0.08) !important;
          border-color: rgba(239, 68, 68, 0.2) !important;
          color: #f87171 !important;
        }

        /* Recent payment history styled container */
        .recent-history-container {
          background: rgba(30, 41, 59, 0.25) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          border-radius: 16px !important;
          padding: 16px !important;
          margin-top: 12px;
        }

        .recent-history-container h4 {
          font-size: 0.78rem !important;
          font-weight: 800 !important;
          color: #94a3b8 !important;
          margin: 0 0 12px 0 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }

        .recent-history-container .history-table-wrap {
          margin: 0 !important;
          max-height: none !important;
          overflow: hidden;
        }

        .recent-history-container .history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem !important;
        }

        .recent-history-container .history-table th {
          color: #64748b !important;
          font-weight: 700 !important;
          font-size: 0.72rem !important;
          text-transform: uppercase !important;
          letter-spacing: 0.03em !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          padding: 8px 4px !important;
          text-align: left;
        }

        .recent-history-container .history-table td {
          padding: 8px 4px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
          color: #cbd5e1 !important;
        }

        .recent-history-container .history-table tr:last-child td {
          border-bottom: none !important;
        }

        .recent-history-container .amount-col {
          color: #4ade80 !important; /* Emerald success glow */
          font-weight: 700 !important;
        }

        /* Payment Summary Card */
        .payment-summary-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.7) 100%) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 20px !important;
          padding: 20px !important;
          margin-bottom: 4px;
        }

        .summary-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .summary-card-header h4 {
          margin: 0 !important;
          font-size: 0.9rem !important;
          font-weight: 800 !important;
          color: #ffffff !important;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .full-payment-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem !important;
          font-weight: 800 !important;
          color: #4ade80 !important;
          background: rgba(74, 222, 128, 0.08) !important;
          padding: 4px 10px !important;
          border-radius: 8px !important;
          border: 1px solid rgba(74, 222, 128, 0.15) !important;
        }

        .summary-progress-bar {
          height: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 99px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .summary-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ff8c00, #4ade80) !important;
          border-radius: 99px;
          transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .summary-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .stat-box {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 0.68rem !important;
          font-weight: 750 !important;
          color: #64748b !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }

        .stat-val {
          font-size: 1.15rem !important;
          font-weight: 850 !important;
        }

        .stat-val.total-due {
          color: #f87171 !important; /* Soft Red */
        }

        .stat-val.paying-now {
          color: #ff8c00 !important; /* Soft orange */
        }

        .stat-val.remaining.pending {
          color: #fbbf24 !important; /* Amber alert value */
        }

        .stat-val.remaining.cleared {
          color: #4ade80 !important; /* Emerald success glow */
        }

        /* Action Buttons */
        .form-actions-row {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }

        .btn-primary-custom {
          background: linear-gradient(135deg, #ff8c00 0%, #f97316 100%) !important;
          color: #0f172a !important;
          padding: 12px 28px !important;
          border: none !important;
          border-radius: 12px !important;
          font-weight: 800 !important;
          font-size: 0.95rem !important;
          cursor: pointer !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: 0 4px 12px rgba(251, 146, 60, 0.25) !important;
        }

        .btn-primary-custom:hover {
          background: linear-gradient(135deg, #fbbf24 0%, #ff8c00 100%) !important;
          box-shadow: 0 6px 20px rgba(251, 146, 60, 0.4) !important;
          transform: translateY(-1.5px);
        }

        .btn-secondary-custom {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #cbd5e1 !important;
          padding: 12px 24px !important;
          border-radius: 12px !important;
          font-weight: 700 !important;
          font-size: 0.95rem !important;
          cursor: pointer !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .btn-secondary-custom:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
          color: #ffffff !important;
          transform: translateY(-1px);
        }

        /* Animations */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @media (max-width: 500px) {
          .form-row-custom {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .summary-stats-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
      `}</style>
    </form>
  );
};

export default PaymentForm;
