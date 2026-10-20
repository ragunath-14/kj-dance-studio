import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../config';
import Modal from '../ui/Modal';
import OfferPanel from '../ui/OfferPanel';
import { getClassEntries, getMonthlyFee, getBaseFee, cycleLabel } from '../../../classCatalog';

// Lets the admin give (or change / remove) an offer for an existing student.
// If the current month's bill is unpaid the offer lands on it; if it is already paid the
// offer starts with next month's bill (the server applies the same rule when saving).
const OfferModal = ({ student, onClose, onSaved }) => {
  const latest = (student?.discounts || []).slice(-1)[0];
  const [offer, setOffer] = useState({
    percent: latest?.percent ? String(latest.percent) : '',
    amount: latest?.amount ? String(latest.amount) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [start, setStart] = useState(''); // 'current' | 'next' - decided by the server from the payment records

  useEffect(() => {
    if (!student) return;
    axios.get(`${API_URL}/students/${student._id}/offer-timing`)
      .then(res => setStart(res.data.appliesFrom))
      .catch(() => setStart(''));
  }, [student]);

  if (!student) return null;

  const lines = getClassEntries(student).map(e => ({
    label: `${e.classType}${e.feePlan ? ` (${e.feePlan.replace(' Class', '')} classes/week)` : ''}`,
    fee: getMonthlyFee(e.classType, student.studentCategory, e.feePlan),
  }));
  const note = start === 'current'
    ? 'This month\u2019s bill is unpaid, so the offer applies to the current bill. Earlier bills are not changed.'
    : start === 'next'
      ? 'This month\u2019s bill is already paid, so the offer starts from next month\u2019s bill.'
      : '';

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await axios.put(`${API_URL}/students/${student._id}/discount`, {
        discountPercent: Number(offer.percent) || 0,
        discountAmount: Number(offer.amount) || 0,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the offer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Student Offer" width="520px">
      <p className="offer-student-line">{student.studentName} <span>· {student.phone}</span></p>
      <OfferPanel
        lines={lines}
        baseFee={getBaseFee(student)}
        percent={offer.percent}
        amount={offer.amount}
        onChange={(o) => setOffer({ percent: o.percent, amount: o.amount })}
        note={note}
      />
      {(student.referralRewards || []).length > 0 && (
        <div className="offer-fees" style={{ marginTop: 14 }}>
          <div className="offer-row"><span><b>Referral rewards</b> (added to the offer above)</span></div>
          {student.referralRewards.map((r, i) => (
            <div className="offer-row" key={i}>
              <span>{r.refereeName || 'A friend'} joined</span>
              <strong>{r.percent}% off {cycleLabel(student.createdAt || student.joinDate, r.cycle)} bill</strong>
            </div>
          ))}
        </div>
      )}
      {error && <p className="offer-note" style={{ marginTop: 12, background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)', color: 'var(--error)' }}>{error}</p>}
      <div className="offer-dialog-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="button" className="offer-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Offer'}
        </button>
      </div>
    </Modal>
  );
};

export default OfferModal;
