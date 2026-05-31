import React, { useState, useMemo, useEffect } from 'react';
import Button from '../ui/Button';
import { Search, User, Clock, CreditCard } from 'lucide-react';
import API_URL from '../../config';

const PaymentForm = ({ formData, setFormData, students, payments = [], currentDebt, isEditing, submitting, onSubmit, onCancel }) => {
  const initialStudentName = useMemo(() => {
    if (!formData.studentId) return '';
    const student = students.find(s => s._id === formData.studentId);
    return student ? (student.studentName || student.name) : '';
  }, [formData.studentId, students]);

  const [studentSearch, setStudentSearch] = useState(initialStudentName);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localDebt, setLocalDebt] = useState(0);

  // Fetch dues on mount if studentId exists (e.g. for editing)
  useEffect(() => {
    if (formData.studentId) {
      fetchDues(formData.studentId, isEditing ? Number(formData.amount) : 0);
    }
  }, []);

  // Sync localDebt when currentDebt prop changes (from handlePay in parent)
  useEffect(() => {
    if (currentDebt) setLocalDebt(currentDebt);
  }, [currentDebt]);

  const fetchDues = async (studentId, addBackAmount = 0) => {
    try {
      const res = await fetch(`${API_URL}/students/${studentId}/public-dues`).then(r => r.json());
      if (res && res.totalDue !== undefined) {
        setLocalDebt(res.totalDue + addBackAmount);
      }
    } catch (err) {
      console.error('Failed to fetch student dues:', err);
    }
  };

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
    
    // Dynamically fetch current dues for this student to ensure accurate partial payment calculation
    fetchDues(student._id);
  };

  // Helper to set amount to total due when selecting a new student
  useEffect(() => {
    if (!isEditing && localDebt > 0 && formData.studentId && !formData.amount) {
        setFormData(prev => ({ ...prev, amount: localDebt, remainingFees: 0 }));
    }
  }, [localDebt, isEditing]);

  const studentPayments = useMemo(() => {
    if (!formData.studentId || !payments) return [];
    return payments
      .filter(p => (p.studentId?._id || p.studentId) === formData.studentId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5); // Show latest 5 transactions
  }, [formData.studentId, payments]);

  return (
    <form onSubmit={onSubmit} onClick={() => setShowSuggestions(false)}>
      <div className="form-group" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <label>Student Search</label>
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text"
            placeholder="Type student name or email..."
            value={studentSearch}
            autoComplete="off"
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
          <div className="selected-student-card">
            <div className="card-icon"><User size={18} /></div>
            <div className="card-info">
              <div className="name-row">
                <strong>{students.find(s => s._id === formData.studentId)?.studentName}</strong>
                <span className="badge">{students.find(s => s._id === formData.studentId)?.classType}</span>
              </div>
              <div className="meta-row">
                <span>{students.find(s => s._id === formData.studentId)?.danceStyle}</span>
                <span>•</span>
                <span>{students.find(s => s._id === formData.studentId)?.email}</span>
              </div>
            </div>
            <button type="button" className="clear-selection" onClick={() => {
              setFormData({...formData, studentId: ''});
              setStudentSearch('');
            }}>Change</button>
          </div>
        )}
        
        {formData.studentId && studentPayments.length > 0 && !showSuggestions && (
          <div className="recent-history-container" style={{ 
            marginTop: '16px', 
            background: 'var(--surface-overlay)', 
            padding: '16px', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)' 
          }}>
            <h4 style={{ 
              fontSize: '11px', 
              color: 'var(--text-muted)', 
              marginBottom: '12px', 
              textTransform: 'uppercase', 
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Clock size={12} />
              Recent Payment History
            </h4>
            <div className="history-table-wrap" style={{ maxHeight: 'none', margin: 0 }}>
              <table className="history-table" style={{ fontSize: '13px', width: '100%' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px 0', textAlign: 'left', color: 'var(--text-muted)', fontSize: '10px' }}>Date</th>
                    <th style={{ padding: '8px 0', textAlign: 'left', color: 'var(--text-muted)', fontSize: '10px' }}>Amount</th>
                    <th style={{ padding: '8px 0', textAlign: 'left', color: 'var(--text-muted)', fontSize: '10px' }}>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {studentPayments.map((p, i) => (
                    <tr key={i} style={{ borderBottom: i === studentPayments.length - 1 ? 'none' : '1px solid var(--surface-subtle)' }}>
                      <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>{new Date(p.date).toLocaleDateString('en-GB')}</td>
                      <td style={{ padding: '10px 0', color: 'var(--success)', fontWeight: 700 }}>₹{p.amount?.toLocaleString()}</td>
                      <td style={{ padding: '10px 0', color: 'var(--text-secondary)' }}>{p.method || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label><CreditCard size={16} /> Amount (₹)</label>
          <input 
            type="number" 
            value={formData.amount} 
            onChange={(e) => {
              const amount = Number(e.target.value);
              const remaining = Math.max(0, localDebt - amount);
              setFormData({ ...formData, amount: e.target.value, remainingFees: remaining });
            }} 
            required 
          />
        </div>
        <div className="form-group">
          <label><Clock size={16} /> Payment Date</label>
          <input 
            type="date" 
            value={formData.date ? formData.date.split('T')[0] : new Date().toISOString().split('T')[0]} 
            onChange={(e) => setFormData({...formData, date: e.target.value})} 
          />
        </div>
      </div>

      {localDebt > 0 && (
        <div className="partial-payment-summary">
          <div className="summary-title">
            <Clock size={14} />
            <span>Payment Summary</span>
          </div>
          
          <div className="summary-metrics">
            <div className="metric-item">
              <span className="metric-label">Total Due</span>
              <span className="metric-value total">₹{localDebt.toLocaleString()}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Paying</span>
              <span className="metric-value paying">₹{Number(formData.amount || 0).toLocaleString()}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Remaining</span>
              <span className="metric-value remaining">₹{(formData.remainingFees || 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="payment-progress-container">
            <div 
              className="payment-progress-bar" 
              style={{ width: `${Math.min(100, (Number(formData.amount || 0) / localDebt) * 100)}%` }}
            ></div>
          </div>

          <div className="payment-status-message">
            {(formData.remainingFees || 0) === 0 ? (
              <span className="status-text cleared">✓ Full Payment: Fees will be cleared</span>
            ) : (
              <span className="status-text partial">! Partial Payment: ₹{(formData.remainingFees || 0).toLocaleString()} will remain due</span>
            )}
            
            {!isEditing && (formData.remainingFees || 0) > 0 && (
              <button 
                type="button" 
                className="pay-full-shortcut"
                onClick={() => setFormData(prev => ({ ...prev, amount: localDebt, remainingFees: 0 }))}
              >
                Pay Full
              </button>
            )}
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label><CreditCard size={16} /> Payment Method</label>
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
        <div className="form-group">
          <label><Search size={16} /> Purpose</label>
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
      <div className="modal-footer">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Payment'}
        </Button>
      </div>

    </form>
  );
};

export default PaymentForm;
