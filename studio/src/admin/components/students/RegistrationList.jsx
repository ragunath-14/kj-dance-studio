import React, { useState } from 'react';
import { Check, X, Clock, User, Phone } from 'lucide-react';
import { useData } from '../../context/DataContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import './RegistrationList.css';

const RegistrationList = () => {
  const { registrations, approveRegistration, rejectRegistration, loading } = useData();
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectConfirm, setRejectConfirm] = useState({ open: false, id: null });
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'error') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 4000);
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    const result = await approveRegistration(id);
    setActionLoading(null);
    if (!result.success) {
      showFeedback(result.message || 'Failed to approve registration.');
    }
  };

  const handleReject = (id) => {
    setRejectConfirm({ open: true, id });
  };

  const executeReject = async () => {
    const id = rejectConfirm.id;
    setRejectConfirm({ open: false, id: null });
    setActionLoading(id);
    const result = await rejectRegistration(id);
    setActionLoading(null);
    if (!result.success) {
      showFeedback(result.message || 'Failed to reject registration.');
    }
  };

  if (!loading && registrations.length === 0) {
    return (
      <div className="empty-state">
        <Clock size={48} />
        <p>No pending registrations at the moment.</p>
      </div>
    );
  }

  const isBusy = (id) => actionLoading === id;

  return (
    <div className="registration-list-container">
      <h2>Pending Registrations</h2>

      {/* Feedback banner */}
      {feedback.message && (
        <div style={{
          margin: '0 0 12px 0', padding: '10px 16px', borderRadius: '8px',
          fontSize: '0.875rem',
          background: feedback.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: feedback.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${feedback.type === 'success' ? '#6ee7b7' : '#fca5a5'}`
        }}>
          {feedback.type === 'success' ? '✅' : '❌'} {feedback.message}
        </div>
      )}

      <div className="registration-grid">
        {registrations.map((reg) => (
          <div key={reg._id} className="registration-card">
            <div className="reg-info">
              <div className="reg-header">
                <User size={20} />
                <h3>{reg.studentName}</h3>
                <span className="reg-date">{new Date(reg.createdAt).toLocaleDateString()}</span>
              </div>
              
              <div className="reg-details">
                <div className="detail-item">
                  <Phone size={14} />
                  <span>{reg.phone}</span>
                </div>
                {reg.classType && (
                  <div className="detail-tag">
                    {reg.classType}
                  </div>
                )}
                {reg.danceStyle && (
                   <div className="detail-tag style">
                     {reg.danceStyle}
                   </div>
                )}
              </div>

              {reg.notes && (
                <div className="reg-notes">
                  <strong>Notes:</strong> {reg.notes}
                </div>
              )}
            </div>

            <div className="reg-actions">
              <button 
                className="btn-approve" 
                onClick={() => handleApprove(reg._id)}
                disabled={isBusy(reg._id)}
              >
                {isBusy(reg._id) ? <span className="reg-spinner"></span> : <><Check size={18} /> Accept</>}
              </button>
              <button 
                className="btn-reject" 
                onClick={() => handleReject(reg._id)}
                disabled={isBusy(reg._id)}
              >
                {isBusy(reg._id) ? <span className="reg-spinner"></span> : <><X size={18} /> Reject</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm Reject Dialog */}
      <ConfirmDialog
        isOpen={rejectConfirm.open}
        title="Reject Registration"
        message="Are you sure you want to reject this registration? This cannot be undone."
        confirmText="Yes, Reject"
        cancelText="Cancel"
        danger={true}
        onConfirm={executeReject}
        onCancel={() => setRejectConfirm({ open: false, id: null })}
      />
    </div>
  );
};

export default RegistrationList;
