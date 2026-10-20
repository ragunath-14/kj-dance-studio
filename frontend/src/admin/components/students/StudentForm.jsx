import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../config';
import { User, Phone, MessageCircle, Calendar, Users, Music } from 'lucide-react';
import Button from '../ui/Button';
import { ALL_CLASS_TYPES, SPECIAL_CLASSES, ZUMBA_CLASS, isSpecialClass, fixedBatchTiming, computeCategory, getBaseFee, computeDiscount, formatRupees, REFERRAL_PERCENT } from '../../../classCatalog';

const StudentForm = ({ formData, setFormData, onSubmit, onCancel, isEditing }) => {
  const [isSameNumber, setIsSameNumber] = useState(
    formData.whatsappNumber === formData.phone && formData.phone !== ''
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(isSameNumber && name === 'phone' ? { whatsappNumber: value } : {}),
      ...(name === 'createdAt' ? { createdAt: new Date(value).toISOString() } : {})
    }));
  };

  const handleSameAsPhone = () => {
    const newSame = !isSameNumber;
    setIsSameNumber(newSame);
    if (newSame) setFormData(prev => ({ ...prev, whatsappNumber: prev.phone }));
  };

  const studentCategory = computeCategory(formData.studentAge, formData.classType);

  // Every class the student takes: the primary one plus any extras
  const extras = formData.extraClasses || [];
  const allClasses = [
    { classType: formData.classType, feePlan: formData.feePlan, batchTiming: formData.batchTiming, primary: true },
    ...extras.map((e, idx) => ({ ...e, idx })),
  ].filter(c => c.classType);
  const zumbaEntries = allClasses.filter(c => c.classType === ZUMBA_CLASS);
  const zumbaInfo = SPECIAL_CLASSES[ZUMBA_CLASS];
  const needsZumbaChoice = zumbaEntries.some(z => !(z.feePlan && z.batchTiming)); // Zumba needs a plan + batch
  const showSchedule = allClasses.some(c => !isSpecialClass(c.classType));
  const updateEntry = (c, patch) => setFormData(prev => c.primary
    ? { ...prev, ...patch }
    : { ...prev, extraClasses: (prev.extraClasses || []).map((e, i) => (i === c.idx ? { ...e, ...patch } : e)) });
  const toggleExtra = (type) => setFormData(prev => {
    const list = prev.extraClasses || [];
    return list.some(e => e.classType === type)
      ? { ...prev, extraClasses: list.filter(e => e.classType !== type) }
      : { ...prev, extraClasses: [...list, { classType: type, feePlan: '', batchTiming: fixedBatchTiming(type) }] };
  });
  const monthlyFee = getBaseFee({ ...formData, studentCategory });

  // Offer typed by the admin (new students only): % and/or ₹ off the monthly fee
  const offerAmount = computeDiscount(monthlyFee, formData.discountPercent, formData.discountAmount);
  const finalFee = monthlyFee - offerAmount;
  const setOffer = (field, raw, max) => {
    let v = raw === '' ? '' : Math.max(0, Number(raw));
    if (v !== '' && max && v > max) v = max;
    setFormData(prev => ({ ...prev, [field]: v }));
  };

  // Referral code (new students only): tell the admin straight away whether it works
  const [refCheck, setRefCheck] = useState({ state: 'idle', message: '' });
  useEffect(() => {
    const code = (formData.referralCode || '').replace(/[^a-zA-Z0-9]/g, '');
    if (isEditing || code.length < 4) { setRefCheck({ state: 'idle', message: '' }); return undefined; }
    setRefCheck({ state: 'checking', message: 'Checking code…' });
    let cancelled = false;
    const timer = setTimeout(() => {
      axios.get(`${API_URL}/referral/check/${encodeURIComponent(code)}`)
        .then(res => { if (!cancelled) setRefCheck(res.data.valid
          ? { state: 'valid', message: `Code accepted — ${res.data.referrerName} gets ${REFERRAL_PERCENT}% off a bill when you save` }
          : { state: 'invalid', message: res.data.title ? `${res.data.title}. ${res.data.message}` : (res.data.message || 'This referral code cannot be used.') }); })
        .catch(() => { if (!cancelled) setRefCheck({ state: 'idle', message: '' }); });
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formData.referralCode, isEditing]);

  const isValid =
    formData.studentName?.trim() &&
    formData.phone?.trim() &&
    formData.classType &&
    !needsZumbaChoice;

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    // Build the complete payload synchronously and pass it directly to the parent
    // This avoids the async setState race condition that caused fields to disappear
    const payload = { ...formData, studentCategory };
    onSubmit(e, payload);
  };

  return (
    <form onSubmit={handleFormSubmit} className="admin-student-form">

      <div className="form-group full-width">
        <label><User size={14} /> Student's Full Name *</label>
        <input
          type="text"
          name="studentName"
          value={formData.studentName || ''}
          onChange={handleChange}
          placeholder="Student Name"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label><Phone size={14} /> Phone Number *</label>
          <input
            type="text"
            name="phone"
            value={formData.phone || ''}
            onChange={handleChange}
            placeholder="Contact Number"
          />
        </div>
        <div className="form-group">
          <div className="label-with-action">
            <label><MessageCircle size={14} /> WhatsApp Number</label>
            <div className={`same-as-badge-admin ${isSameNumber ? 'active' : ''}`} onClick={handleSameAsPhone}>
              <span>Same as phone</span>
            </div>
          </div>
          <input
            type="text"
            name="whatsappNumber"
            value={formData.whatsappNumber || ''}
            onChange={handleChange}
            placeholder="WhatsApp Number"
            disabled={isSameNumber}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label><Calendar size={14} /> Student Age</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              name="studentAge"
              value={formData.studentAge || ''}
              onChange={handleChange}
              placeholder="Age"
              min="1"
              max="99"
            />
            {formData.studentAge && (
              <span className="category-auto-badge">{studentCategory}</span>
            )}
          </div>
        </div>
        <div className="form-group">
          <label><Users size={14} /> Gender</label>
          <select name="gender" value={formData.gender || ''} onChange={handleChange}>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="form-group full-width">
        <label><Music size={14} /> Dance Class *</label>
        <div className="class-type-selector-admin">
          {ALL_CLASS_TYPES.map(type => (
            <div
              key={type}
              className={`type-option-admin ${formData.classType === type ? 'selected' : ''}`}
              onClick={() => setFormData(prev => ({
                ...prev,
                classType: type,
                danceForFitness: type !== 'Fitness Class' ? '' : prev.danceForFitness,
                // Special classes have a fixed timetable; Weekday/Weekend doesn't apply
                classSchedule: isSpecialClass(type) ? 'NA' : prev.classSchedule,
                batchTiming: fixedBatchTiming(type),
                feePlan: '',
                extraClasses: (prev.extraClasses || []).filter(e => e.classType !== type)
              }))}
            >
              {type}
              {type === 'Fitness Class' && <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '6px' }}>— Adults only</span>}
              {type === 'Online Class' && <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '6px' }}>— Virtual</span>}
              {isSpecialClass(type) && <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '6px' }}>— {SPECIAL_CLASSES[type].feeText}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="form-group full-width">
        <label><Music size={14} /> Additional Classes <span style={{ fontSize: '11px', opacity: 0.7, textTransform: 'none' }}>(optional — more than one class)</span></label>
        <div className="class-type-selector-admin">
          {ALL_CLASS_TYPES.filter(t => t !== formData.classType).map(type => (
            <div
              key={type}
              className={`type-option-admin ${extras.some(e => e.classType === type) ? 'selected' : ''}`}
              onClick={() => toggleExtra(type)}
            >
              {extras.some(e => e.classType === type) ? '✓ ' : '+ '}{type}
            </div>
          ))}
        </div>
      </div>

      {zumbaEntries.map(z => (
        <React.Fragment key={z.primary ? 'primary' : z.idx}>
          <div className="form-group full-width">
            <label><Calendar size={14} /> Zumba Plan *</label>
            <div className="class-type-selector-admin">
              {zumbaInfo.plans.map(plan => (
                <div
                  key={plan.value}
                  className={`type-option-admin ${z.feePlan === plan.value ? 'selected' : ''}`}
                  onClick={() => updateEntry(z, { feePlan: plan.value })}
                >
                  {plan.label}
                  <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '6px' }}>— ₹{plan.fee}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="form-group full-width">
            <label><Calendar size={14} /> Zumba Batch *</label>
            <div className="class-type-selector-admin">
              {zumbaInfo.batches.map(batch => (
                <div
                  key={batch}
                  className={`type-option-admin ${z.batchTiming === batch ? 'selected' : ''}`}
                  onClick={() => updateEntry(z, { batchTiming: batch })}
                >
                  {batch}
                </div>
              ))}
            </div>
          </div>
        </React.Fragment>
      ))}

      {showSchedule && (
      <div className="form-group full-width">
        <label><Calendar size={14} /> Class Schedule</label>
        <div className="class-type-selector-admin">
          {['Weekday', 'Weekend', 'NA'].map(schedule => (
            <div
              key={schedule}
              className={`type-option-admin ${(formData.classSchedule || 'NA') === schedule ? 'selected' : ''}`}
              onClick={() => setFormData(prev => ({ ...prev, classSchedule: schedule }))}
            >
              {schedule === 'NA' ? 'Not Set' : schedule}
              {schedule === 'Weekday' && <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '6px' }}>— Mon–Fri</span>}
              {schedule === 'Weekend' && <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '6px' }}>— Sat & Sun</span>}
            </div>
          ))}
        </div>
      </div>
      )}

      <div className="form-group full-width">
        <label>Fee per month {isEditing ? '(before any offer)' : ''}</label>
        <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary-color)' }}>
          {needsZumbaChoice ? 'Choose the Zumba plan' : formatRupees(monthlyFee)}
          {allClasses.length > 1 && <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginLeft: '8px' }}>{allClasses.length} classes</span>}
        </div>
      </div>

      {!isEditing && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>Offer % <span style={{ fontSize: '11px', opacity: 0.7, textTransform: 'none' }}>(optional)</span></label>
              <input type="number" inputMode="decimal" min="0" max="100" placeholder="0"
                value={formData.discountPercent ?? ''} onChange={(e) => setOffer('discountPercent', e.target.value, 100)} />
            </div>
            <div className="form-group">
              <label>Offer amount ₹ <span style={{ fontSize: '11px', opacity: 0.7, textTransform: 'none' }}>(optional)</span></label>
              <input type="number" inputMode="numeric" min="0" placeholder="0"
                value={formData.discountAmount ?? ''} onChange={(e) => setOffer('discountAmount', e.target.value)} />
            </div>
          </div>

          {!needsZumbaChoice && offerAmount > 0 && (
            <div className="form-group full-width">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px 12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                <span>Offer <b style={{ color: 'var(--success)' }}>− {formatRupees(offerAmount)}</b></span>
                <span>Final fee <b style={{ color: 'var(--primary-color)', fontSize: '18px' }}>{formatRupees(finalFee)}</b> / month</span>
              </div>
            </div>
          )}

          <div className="form-group full-width">
            <label>Referral Code <span style={{ fontSize: '11px', opacity: 0.7, textTransform: 'none' }}>(optional — if an existing student referred this one)</span></label>
            <input
              type="text"
              name="referralCode"
              value={formData.referralCode || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, referralCode: e.target.value.toUpperCase() }))}
              placeholder="e.g. KJARUN47"
              autoComplete="off"
              maxLength={14}
            />
            {refCheck.state !== 'idle' && (
              <p style={{ margin: '8px 0 0', fontSize: '13px', fontWeight: 800,
                color: refCheck.state === 'valid' ? 'var(--success)' : refCheck.state === 'invalid' ? 'var(--error)' : 'var(--text-muted)' }}>
                {refCheck.message}
              </p>
            )}
          </div>
        </>
      )}

      <div className="form-row">
        <div className="form-group full-width">
          <label><Calendar size={14} /> Join Date</label>
          <input
            type="date"
            name="createdAt"
            value={formData.createdAt
              ? new Date(formData.createdAt).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0]}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="modal-footer">
        <div className="footer-left">
          <Button variant="ghost" onClick={onCancel} type="button">Cancel</Button>
        </div>
        <div className="footer-right">
          <Button type="submit" variant="primary" disabled={!isValid}>
            {isEditing ? 'Update Student' : 'Save Student'}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default StudentForm;
