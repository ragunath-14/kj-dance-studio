import React, { useState } from 'react';
import { Check, X, Clock, User, Phone } from 'lucide-react';
import { useData } from '../../context/DataContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import { formatRupees, computeDiscount } from '../../../classCatalog';
import Pagination from '../Pagination';
import './RegistrationList.css';

const RegistrationList = () => {
  const { registrations, fetchRegistrations, approveRegistration, rejectRegistration, loading } = useData();
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectConfirm, setRejectConfirm] = useState({ open: false, id: null });
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const list       = registrations.data       || [];
  const total      = registrations.total      || 0;
  const page       = registrations.page       || 1;
  const limit      = registrations.limit      || 10;
  const totalPages = registrations.totalPages || 1;

  const showFeedback = (message, type = 'error') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 4000);
  };

  // Offer typed on each request card: % and/or ₹ off the monthly fee, applied when the admin accepts
  const [offers, setOffers] = useState({});
  const offerOf = (id) => offers[id] || { percent: '', amount: '' };
  const setOffer = (id, field, raw, max) => {
    let v = raw === '' ? '' : Math.max(0, Number(raw));
    if (v !== '' && max && v > max) v = max;
    setOffers(prev => ({ ...prev, [id]: { ...offerOf(id), [field]: v } }));
  };

  const handleApprove = async (reg) => {
    const offer = offerOf(reg._id);
    setActionLoading(reg._id);
    const result = await approveRegistration(reg._id, {
      discountPercent: Number(offer.percent) || 0,
      discountAmount: Number(offer.amount) || 0,
    });
    setActionLoading(null);
    if (!result.success) showFeedback(result.message || 'Failed to approve registration.');
    else if (result.referral?.note) showFeedback(`Accepted. Referral: ${result.referral.note}`, result.referral.result === 'rewarded' ? 'success' : 'error');
  };

  const handleReject = (id) => setRejectConfirm({ open: true, id });

  const executeReject = async () => {
    const id = rejectConfirm.id;
    setRejectConfirm({ open: false, id: null });
    setActionLoading(id);
    const result = await rejectRegistration(id);
    setActionLoading(null);
    if (!result.success) showFeedback(result.message || 'Failed to reject registration.');
  };

  if (!loading && list.length === 0) {
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
      <h2>New Joiner Requests</h2>

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
        {list.map((reg) => (
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
                {reg.studentCategory && (
                  <div className="detail-tag">{reg.studentCategory}</div>
                )}
                {(reg.classBreakdown || []).map((c, i) => (
                  <div className="detail-tag" key={i}>{c.classType}{c.feePlan ? ` · ${c.feePlan.replace(' Class', '')}/wk` : ''}</div>
                ))}
                {!reg.classBreakdown && reg.classType && (
                  <div className="detail-tag">{reg.classType}</div>
                )}
                {reg.feePlan && (
                  <div className="detail-tag">{reg.feePlan}</div>
                )}
                {reg.batchTiming && (
                  <div className="detail-tag schedule-tag">{reg.batchTiming}</div>
                )}
                {reg.classSchedule && reg.classSchedule !== 'NA' && (
                  <div className="detail-tag schedule-tag">{reg.classSchedule}</div>
                )}
              </div>

              {reg.baseFee > 0 && (
                <div className="reg-fee">
                  Fee: <strong>{formatRupees(reg.baseFee)}</strong> / month
                  {(reg.classBreakdown || []).length > 1 && <span className="reg-fee-multi"> · {reg.classBreakdown.length} classes</span>}
                </div>
              )}

              {reg.referral && (
                <div className={`reg-referral ${reg.referral.valid ? '' : 'reg-referral--bad'}`}>
                  <span>🎁 Referred by <b>{reg.referral.referrerName || 'unknown'}</b> · {reg.referral.code}</span>
                  <small>
                    {reg.referral.valid
                      ? `Accepting gives ${reg.referral.referrerName} ${reg.referral.percent}% off a monthly bill (added to any other referrals).${reg.referral.codeExpired ? ' The code has been replaced since, but it was valid when this friend registered, so the reward still applies.' : ''}`
                      : `${reg.referral.problem} — no reward will be given.`}
                  </small>
                </div>
              )}

              {reg.baseFee > 0 && (() => {
                const offer = offerOf(reg._id);
                const discount = computeDiscount(reg.baseFee, offer.percent, offer.amount);
                return (
                  <div className="reg-offer">
                    <div className="reg-offer-inputs">
                      <label>
                        <span>Offer %</span>
                        <div className="reg-offer-wrap">
                          <input type="number" inputMode="decimal" min="0" max="100" placeholder="0"
                            value={offer.percent} onChange={(e) => setOffer(reg._id, 'percent', e.target.value, 100)} />
                          <i>%</i>
                        </div>
                      </label>
                      <label>
                        <span>Offer amount</span>
                        <div className="reg-offer-wrap">
                          <input type="number" inputMode="numeric" min="0" placeholder="0"
                            value={offer.amount} onChange={(e) => setOffer(reg._id, 'amount', e.target.value)} />
                          <i>₹</i>
                        </div>
                      </label>
                    </div>
                    {discount > 0 && (
                      <div className="reg-offer-result">
                        <span>Offer <b>− {formatRupees(discount)}</b></span>
                        <span>Final fee <strong>{formatRupees(reg.baseFee - discount)}</strong> / month</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {reg.notes && (
                <div className="reg-notes">
                  <strong>Notes:</strong> {reg.notes}
                </div>
              )}
            </div>

            <div className="reg-actions">
              <button
                className="btn-approve"
                onClick={() => handleApprove(reg)}
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

      <Pagination
        currentPage={page}
        totalItems={total}
        itemsPerPage={limit}
        onPageChange={(p) => fetchRegistrations(p, limit)}
        onLimitChange={(l) => fetchRegistrations(1, l)}
      />

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
