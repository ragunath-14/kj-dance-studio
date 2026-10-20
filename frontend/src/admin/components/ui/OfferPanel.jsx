import React from 'react';
import { formatRupees, computeDiscount } from '../../../classCatalog';
import './OfferPanel.css';

// Fee breakdown + the offer inputs the admin fills in (percentage and/or flat amount off).
// `lines` = [{ label, fee }], `baseFee` = their total. Fully controlled via percent/amount + onChange.
const OfferPanel = ({ lines, baseFee, percent, amount, onChange, note }) => {
  const discount = computeDiscount(baseFee, percent, amount);
  const finalFee = baseFee - discount;

  const set = (field) => (e) => {
    const raw = e.target.value;
    // keep it a clean non-negative number; percentage is capped at 100
    let v = raw === '' ? '' : Math.max(0, Number(raw));
    if (field === 'percent' && v !== '' && v > 100) v = 100;
    onChange({ percent, amount, [field]: v });
  };

  return (
    <div className="offer-panel">
      <div className="offer-fees">
        {lines.map((l, i) => (
          <div className="offer-row" key={i}><span>{l.label}</span><strong>{formatRupees(l.fee)}</strong></div>
        ))}
        <div className="offer-row offer-row--sum"><span>Fee per month</span><strong>{formatRupees(baseFee)}</strong></div>
      </div>

      <div className="offer-inputs">
        <label className="offer-field">
          <span>Discount %</span>
          <div className="offer-input-wrap">
            <input type="number" inputMode="decimal" min="0" max="100" placeholder="0" value={percent} onChange={set('percent')} />
            <i>%</i>
          </div>
        </label>
        <label className="offer-field">
          <span>Discount amount</span>
          <div className="offer-input-wrap">
            <input type="number" inputMode="numeric" min="0" placeholder="0" value={amount} onChange={set('amount')} />
            <i>₹</i>
          </div>
        </label>
      </div>

      <div className="offer-result">
        <div className="offer-row"><span>Offer discount</span><strong className="offer-minus">{discount > 0 ? `− ${formatRupees(discount)}` : '—'}</strong></div>
        <div className="offer-row offer-row--final"><span>Final fee per month</span><strong>{formatRupees(finalFee)}</strong></div>
      </div>

      {note && <p className="offer-note">{note}</p>}
    </div>
  );
};

export default OfferPanel;
