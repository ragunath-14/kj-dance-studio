import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { User, Phone, MessageCircle, Calendar, Users, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import {
  SPECIAL_CLASSES, ALL_CLASS_TYPES, ZUMBA_CLASS, isSpecialClass, fixedBatchTiming,
  computeCategory, getMonthlyFee, formatRupees
} from '../classCatalog';
import { validateRegistration, incompleteReferralProblem, describeSubmitError, REFERRAL_CODE_LENGTH } from '../registrationValidation';
import './Register.css';

/* ─── Custom Dropdown (single or multi select) ────────────────────────────── */
const CustomSelect = ({ value, onChange, options, placeholder, disabled, title, multiple = false, hasError = false, describedBy }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const values = multiple ? (value || []) : [value];
  const isSelected = (v) => values.includes(v);
  const selectedOptions = options.filter(o => isSelected(o.value));
  const triggerText = selectedOptions.map(o => o.label).join(', ');

  const pick = (v) => {
    onChange(v);
    if (!multiple) setOpen(false);
  };

  return (
    <div className={`custom-select${open ? ' open' : ''}${disabled ? ' disabled' : ''}${hasError ? ' has-error' : ''}`} ref={ref}>
      <button
        type="button"
        className="custom-select__trigger"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? describedBy : undefined}
      >
        <span className={triggerText ? 'custom-select__value' : 'custom-select__placeholder'}>
          {triggerText || placeholder}
        </span>
        {multiple && selectedOptions.length > 1 && (
          <span className="custom-select__count">{selectedOptions.length}</span>
        )}
        <ChevronDown size={16} className="custom-select__chevron" />
      </button>
      {open && (
        <>
          <div className="custom-select__backdrop" onClick={() => setOpen(false)} />
          <ul className="custom-select__menu">
            {title && <li className="custom-select__title">{title}</li>}
            {options.map(opt => (
              <li
                key={opt.value}
                className={`custom-select__option${isSelected(opt.value) ? ' selected' : ''}`}
                onClick={() => pick(opt.value)}
              >
                {multiple && (
                  <span className="custom-select__check">{isSelected(opt.value) && <Check size={13} strokeWidth={3} />}</span>
                )}
                <span className="custom-select__option-label">{opt.label}</span>
                {opt.sub && <span className="custom-select__option-sub">{opt.sub}</span>}
                {opt.meta && <span className="custom-select__option-meta">{opt.meta}</span>}
              </li>
            ))}
            {multiple && (
              <li className="custom-select__done">
                <button type="button" onClick={() => setOpen(false)}>Done</button>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
};

/* A red message under a field. Shown only after the visitor has touched the field or tried to submit. */
const FieldError = ({ field, message }) => (message
  ? <p className="field-error" id={`err-${field}`} role="alert"><AlertTriangle size={13} /> {message}</p>
  : null);

const EMPTY_FORM = {
  studentName: '',
  studentAge: '',
  gender: '',
  classTypes: [],       // one or more classes
  classSchedule: '',    // Weekday / Weekend — only for the regular, fitness and online classes
  danceForFitness: '',
  zumbaBatch: '',       // Zumba batch
  feePlan: '',          // Zumba plan: '5 Class' | '3 Class'
  referralCode: '',     // optional: code of the student who referred this person
  whatsappNumber: '',
  phone: '',
};

const FIELD_LABEL = {
  studentName: 'Full name', phone: 'Phone number', whatsappNumber: 'WhatsApp number', studentAge: 'Age',
  classTypes: 'Class', classSchedule: 'Class schedule', feePlan: 'Zumba plan', zumbaBatch: 'Zumba batch', referralCode: 'Referral code',
};

/* ─── Main Component ─────────────────────────────────────────────────────── */
const Register = ({ isOpen, onClose, campEnabled = false, initialMode = 'class', initialClass = '', initialReferral = '' }) => {
  const [mode, setMode] = useState('class'); // 'class' | 'camp'
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSameNumber, setIsSameNumber] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [touched, setTouched] = useState({});             // fields the visitor has left
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});   // messages the server gave for a field
  const [refPopup, setRefPopup] = useState(null);         // { title, message, steps } — why a referral code cannot be used
  const formRef = useRef(null);
  const lastPopupFor = useRef('');                        // the code the pop-up was last shown for

  // Each time the modal opens, start on the tab the opener asked for
  useEffect(() => {
    if (isOpen) setMode(initialMode);
  }, [isOpen, initialMode]);

  // A "Join This Class" button on the landing page opens the form with that class already chosen
  useEffect(() => {
    if (isOpen && initialClass && ALL_CLASS_TYPES.includes(initialClass)) {
      setFormData(prev => ({ ...prev, classTypes: [initialClass] }));
    }
  }, [isOpen, initialClass]);

  // A shared link (?ref=CODE) opens the form with the code already filled in
  useEffect(() => {
    if (isOpen && initialReferral) setFormData(prev => ({ ...prev, referralCode: initialReferral }));
  }, [isOpen, initialReferral]);

  // Check the referral code with the studio as soon as all 8 characters are typed.
  // Only a code that really works is shown as accepted; anything else gets an explanation.
  const [refCheck, setRefCheck] = useState({ state: 'idle' }); // idle | typing | checking | valid | invalid
  const cleanedCode = (formData.referralCode || '').replace(/[^a-zA-Z0-9]/g, '');
  useEffect(() => {
    if (!cleanedCode) { setRefCheck({ state: 'idle' }); return undefined; }
    if (cleanedCode.length < REFERRAL_CODE_LENGTH) { setRefCheck({ state: 'typing' }); return undefined; }
    setRefCheck({ state: 'checking' });
    let cancelled = false;
    const timer = setTimeout(() => {
      axios.get(`/api/referral/check/${encodeURIComponent(cleanedCode)}`)
        .then(res => { if (!cancelled) setRefCheck(res.data.valid
          ? { state: 'valid', referrerName: res.data.referrerName }
          : { state: 'invalid', problem: { title: res.data.title, message: res.data.message, steps: res.data.steps || [] } }); })
        .catch(() => { if (!cancelled) setRefCheck({ state: 'idle' }); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cleanedCode]);

  // a new code → the pop-up may be shown again for it
  useEffect(() => { lastPopupFor.current = ''; }, [cleanedCode]);

  const showReferralPopup = useCallback((problem) => {
    if (!problem) return;
    lastPopupFor.current = cleanedCode;
    setRefPopup(problem);
  }, [cleanedCode]);

  // When the visitor leaves the code box with a code that cannot be used, explain why (once per code)
  const onReferralBlur = () => {
    setTouched(t => ({ ...t, referralCode: true }));
    if (!cleanedCode || lastPopupFor.current === cleanedCode) return;
    if (cleanedCode.length < REFERRAL_CODE_LENGTH) showReferralPopup(incompleteReferralProblem(formData.referralCode));
    else if (refCheck.state === 'invalid') showReferralPopup(refCheck.problem);
  };
  // …and if the answer from the studio arrives after they already left the box
  useEffect(() => {
    if (refCheck.state === 'invalid' && cleanedCode && lastPopupFor.current !== cleanedCode && touched.referralCode
      && document.activeElement?.name !== 'referralCode') {
      showReferralPopup(refCheck.problem);
    }
  }, [refCheck, cleanedCode, touched.referralCode, showReferralPopup]);

  // Camp mode only exists while the admin has camp registration switched on
  const isCamp = campEnabled && mode === 'camp';

  const switchMode = (next) => {
    setMode(next);
    setMessage({ type: '', text: '' });
    setServerErrors({});
    setSubmitAttempted(false);
  };

  // typing in a field removes the server's complaint about it
  const clearServerError = (field) => setServerErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));
  const touch = (field) => setTouched(t => (t[field] ? t : { ...t, [field]: true }));

  const PHONE_FIELDS = ['phone', 'whatsappNumber'];
  const handleChange = (e) => {
    const { name } = e.target;
    let { value } = e.target;
    if (PHONE_FIELDS.includes(name)) value = value.replace(/[^\d\s+\-()]/g, '');   // letters cannot be typed in a phone box
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(isSameNumber && name === 'phone' ? { whatsappNumber: value } : {})
    }));
    clearServerError(name);
    if (name === 'phone' && isSameNumber) clearServerError('whatsappNumber');
  };

  const handleSelectChange = (name) => (value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    clearServerError(name);
    touch(name);
  };

  const handleSameNumber = () => {
    const next = !isSameNumber;
    setIsSameNumber(next);
    if (next) setFormData(prev => ({ ...prev, whatsappNumber: prev.phone }));
  };

  // Tick / untick a class; keeps the order the student chose them in
  const toggleClass = (type) => {
    setFormData(prev => {
      const has = prev.classTypes.includes(type);
      const classTypes = has ? prev.classTypes.filter(t => t !== type) : [...prev.classTypes, type];
      return {
        ...prev,
        classTypes,
        ...(classTypes.includes(ZUMBA_CLASS) ? {} : { feePlan: '', zumbaBatch: '' }),
      };
    });
    clearServerError('classTypes');
    touch('classTypes');
  };

  const selected      = isCamp ? [] : formData.classTypes;
  const hasZumba      = selected.includes(ZUMBA_CLASS);
  const needsSchedule = selected.some(t => !isSpecialClass(t));
  const zumbaInfo     = SPECIAL_CLASSES[ZUMBA_CLASS];

  // Age decides Kids / Adults, which sets the fee of the regular and online classes
  const studentCategory = computeCategory(formData.studentAge, selected[0]);

  // One entry per class the student picked, with its own plan / timing
  const entries = selected.map(type => ({
    classType: type,
    feePlan: type === ZUMBA_CLASS ? formData.feePlan : '',
    batchTiming: type === ZUMBA_CLASS ? formData.zumbaBatch : fixedBatchTiming(type),
    fee: getMonthlyFee(type, studentCategory, type === ZUMBA_CLASS ? formData.feePlan : ''),
  }));
  const totalFee = entries.reduce((sum, e) => sum + e.fee, 0);
  // The price depends on the Zumba plan only (the batch does not change it), so show it as soon as the plan is chosen
  const priceKnown = !(hasZumba && !formData.feePlan);
  const dependsOnAge = !formData.studentAge && selected.some(t => t === 'Regular Class' || t === 'Online Class');

  // ── what is wrong with the form right now
  const problems = validateRegistration(formData, { isCamp, needsSchedule, hasZumba });
  const problemOf = Object.fromEntries(problems.map(p => [p.field, p.message]));
  if (!isCamp && cleanedCode && refCheck.state === 'invalid') problemOf.referralCode = refCheck.problem?.message || 'This referral code cannot be used.';
  else if (!isCamp && cleanedCode && cleanedCode.length < REFERRAL_CODE_LENGTH && (touched.referralCode || submitAttempted))
    problemOf.referralCode = incompleteReferralProblem(formData.referralCode)?.message;
  const ORDER = ['studentName', 'phone', 'whatsappNumber', 'studentAge', 'classTypes', 'feePlan', 'zumbaBatch', 'classSchedule', 'referralCode'];
  const orderedProblems = ORDER.filter(f => problemOf[f]).map(f => ({ field: f, message: problemOf[f] }));

  // show a field's message once it was touched, after a submit attempt, or when the server complained about it
  const errorFor = (field) => serverErrors[field] || ((touched[field] || submitAttempted) ? problemOf[field] : '');

  const focusField = (field) => {
    const wrap = formRef.current?.querySelector(`[data-field="${field}"]`);
    if (!wrap) return;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const control = wrap.querySelector('input, button.custom-select__trigger');
    if (control) setTimeout(() => control.focus({ preventScroll: true }), 250);
  };

  const finishSubmit = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      let res;
      if (isCamp) {
        res = await axios.post('/api/camp/register', {
          studentName: formData.studentName.trim(),
          studentAge: formData.studentAge,
          gender: formData.gender,
          whatsappNumber: formData.whatsappNumber,
          phone: formData.phone,
        });
      } else {
        const [primary, ...extras] = entries;
        res = await axios.post('/api/register', {
          studentName: formData.studentName.trim(),
          studentAge: formData.studentAge,
          gender: formData.gender,
          whatsappNumber: formData.whatsappNumber,
          phone: formData.phone,
          danceForFitness: formData.danceForFitness,
          referralCode: formData.referralCode.trim(),
          studentCategory,
          classType: primary.classType,
          feePlan: primary.feePlan,
          batchTiming: primary.batchTiming,
          classSchedule: needsSchedule ? formData.classSchedule : 'NA',
          extraClasses: extras.map(({ classType, feePlan, batchTiming }) => ({ classType, feePlan, batchTiming })),
        });
      }
      if (res.data.success) {
        setMessage({
          type: 'success',
          text: isCamp
            ? 'Camp registration submitted! We will contact you soon.'
            : formData.referralCode.trim()
              ? 'Registration submitted with your referral code! We will contact you soon.'
              : 'Registration submitted! We will contact you soon.'
        });
        setFormData(EMPTY_FORM);
        setIsSameNumber(false);
        setTouched({});
        setSubmitAttempted(false);
        setServerErrors({});
        setTimeout(onClose, 3000);
      }
    } catch (err) {
      const d = describeSubmitError(err);
      setMessage(d.banner || { type: 'error', text: 'Failed to submit. Please try again.' });
      setServerErrors(d.fieldErrors || {});
      if (d.referral) { setRefCheck({ state: 'invalid', problem: d.referral }); showReferralPopup(d.referral); }
      else {
        const first = ORDER.find(f => d.fieldErrors?.[f]) || (d.fieldErrors?.phone ? 'phone' : null);
        if (first) setTimeout(() => focusField(first), 50);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setSubmitAttempted(true);
    setMessage({ type: '', text: '' });

    // 1. mistakes the visitor can fix right now — shown on the fields, and we jump to the first one
    const blocking = orderedProblems.filter(p => p.field !== 'referralCode');
    if (blocking.length) { setTimeout(() => focusField(blocking[0].field), 50); return; }

    // 2. the referral code (if any) must be one that works — otherwise explain why in a pop-up
    if (!isCamp && cleanedCode) {
      if (cleanedCode.length < REFERRAL_CODE_LENGTH) { showReferralPopup(incompleteReferralProblem(formData.referralCode)); return; }
      try {
        const res = await axios.get(`/api/referral/check/${encodeURIComponent(cleanedCode)}`);
        if (!res.data.valid) {
          const problem = { title: res.data.title, message: res.data.message, steps: res.data.steps || [] };
          setRefCheck({ state: 'invalid', problem });
          showReferralPopup(problem);
          return;
        }
      } catch { /* could not check: let the server decide */ }
    }
    finishSubmit();
  };

  if (!isOpen) return null;

  const classOptions = ALL_CLASS_TYPES.map(type => ({
    value: type,
    label: type,
    sub: type === 'Fitness Class' ? 'Adults only'
      : type === 'Online Class' ? 'Virtual'
      : isSpecialClass(type) ? SPECIAL_CLASSES[type].feeText.replace(' / month', '')
      : '',
    meta: isSpecialClass(type) ? `${SPECIAL_CLASSES[type].days} · ${SPECIAL_CLASSES[type].timing}` : ''
  }));
  const scheduleOptions = [
    { value: 'Weekday', label: 'Weekday', sub: 'Mon to Fri' },
    { value: 'Weekend', label: 'Weekend', sub: 'Sat & Sun' },
  ];

  const genderOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
  ];

  const eName = errorFor('studentName'), ePhone = errorFor('phone'), eWa = errorFor('whatsappNumber'), eAge = errorFor('studentAge');
  const eClass = errorFor('classTypes'), ePlan = errorFor('feePlan'), eBatch = errorFor('zumbaBatch'), eSched = errorFor('classSchedule');
  const eRef = errorFor('referralCode');
  const showSummary = submitAttempted && orderedProblems.length > 0;

  return (
    <div className="register-modal-overlay">
      <div className="register-modal animate-fade-in">
        <button className="close-btn" onClick={onClose} aria-label="Close">&times;</button>

        <div className="register-header">
          <h2>{isCamp ? 'Summer Camp Registration' : 'Student Registration'}</h2>
          <p>{isCamp ? 'Reserve your spot at the KJ Dance Studio summer camp!' : 'Join the KJ Dance Studio family today!'}</p>
        </div>

        {campEnabled && (
          <div className="register-mode-tabs">
            <button
              type="button"
              className={`register-mode-tab ${!isCamp ? 'active' : ''}`}
              onClick={() => switchMode('class')}
            >
              Class Registration
            </button>
            <button
              type="button"
              className={`register-mode-tab ${isCamp ? 'active' : ''}`}
              onClick={() => switchMode('camp')}
            >
              Summer Camp
            </button>
          </div>
        )}

        {message.text && (
          <div className={`message-banner ${message.type}`} role={message.type === 'success' ? 'status' : 'alert'}>
            {message.type === 'success' ? '✅' : message.type === 'warning' ? 'ℹ️' : '❌'} {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="register-form" ref={formRef} noValidate>
          {showSummary && (
            <div className="error-summary" role="alert">
              <p><AlertTriangle size={16} /> {orderedProblems.length === 1 ? 'One thing needs your attention:' : `${orderedProblems.length} things need your attention:`}</p>
              <ul>
                {orderedProblems.map(p => (
                  <li key={p.field}>
                    <button type="button" onClick={() => (p.field === 'referralCode' ? (refCheck.state === 'invalid' ? setRefPopup(refCheck.problem) : focusField('referralCode')) : focusField(p.field))}>
                      <b>{FIELD_LABEL[p.field]}:</b> {p.message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-grid">

            <div className={`form-group full-width${eName ? ' has-error' : ''}`} data-field="studentName">
              <label htmlFor="reg-name"><User size={12} /> Full Name *</label>
              <input id="reg-name" type="text" name="studentName" value={formData.studentName} onChange={handleChange} onBlur={() => touch('studentName')}
                placeholder="Student Name" autoComplete="name" aria-invalid={!!eName} aria-describedby={eName ? 'err-studentName' : undefined} />
              <FieldError field="studentName" message={eName} />
            </div>

            <div className={`form-group${ePhone ? ' has-error' : ''}`} data-field="phone">
              <label htmlFor="reg-phone"><Phone size={12} /> Phone Number *</label>
              <input id="reg-phone" type="tel" inputMode="tel" name="phone" value={formData.phone} onChange={handleChange} onBlur={() => touch('phone')}
                placeholder="Contact Number" autoComplete="tel" aria-invalid={!!ePhone} aria-describedby={ePhone ? 'err-phone' : undefined} />
              <FieldError field="phone" message={ePhone} />
            </div>

            <div className={`form-group${eWa ? ' has-error' : ''}`} data-field="whatsappNumber">
              <div className="label-with-action">
                <label htmlFor="reg-wa"><MessageCircle size={12} /> WhatsApp Number</label>
                <div className={`same-as-badge ${isSameNumber ? 'active' : ''}`} onClick={handleSameNumber}>
                  <span>Same as phone</span>
                </div>
              </div>
              <input
                id="reg-wa"
                type="tel"
                inputMode="tel"
                name="whatsappNumber"
                value={formData.whatsappNumber}
                onChange={handleChange}
                onBlur={() => touch('whatsappNumber')}
                placeholder="WhatsApp Number"
                disabled={isSameNumber}
                aria-invalid={!!eWa}
                aria-describedby={eWa ? 'err-whatsappNumber' : undefined}
              />
              <FieldError field="whatsappNumber" message={eWa} />
            </div>

            <div className={`form-group${eAge ? ' has-error' : ''}`} data-field="studentAge">
              <label htmlFor="reg-age"><Calendar size={12} /> Age</label>
              <div style={{ position: 'relative' }}>
                <input id="reg-age" type="number" name="studentAge" value={formData.studentAge} onChange={handleChange} onBlur={() => touch('studentAge')}
                  placeholder="Age" min="1" max="99" aria-invalid={!!eAge} aria-describedby={eAge ? 'err-studentAge' : undefined} />
                {formData.studentAge && !eAge && (isCamp || selected.length > 0) && (
                  <span className="category-auto-badge">
                    {studentCategory}
                  </span>
                )}
              </div>
              <FieldError field="studentAge" message={eAge} />
            </div>

            <div className="form-group">
              <label><Users size={12} /> Gender</label>
              <CustomSelect
                value={formData.gender}
                onChange={handleSelectChange('gender')}
                options={genderOptions}
                placeholder="Select Gender"
              />
            </div>

            {!isCamp && (
              <>
                <div className={`form-group full-width${eClass ? ' has-error' : ''}`} data-field="classTypes">
                  <label>Class * <span className="label-hint">— you can pick more than one</span></label>
                  <CustomSelect
                    multiple
                    value={formData.classTypes}
                    onChange={toggleClass}
                    options={classOptions}
                    placeholder="Select Class"
                    title="Select Classes"
                    hasError={!!eClass}
                    describedBy="err-classTypes"
                  />
                  <FieldError field="classTypes" message={eClass} />
                </div>

                {selected.filter(isSpecialClass).map(type => {
                  const c = SPECIAL_CLASSES[type];
                  return (
                    <div className="form-group full-width" key={type}>
                      <div className="class-info-card">
                        <p className="class-info-title">{type}</p>
                        <p className="class-info-about">{c.about}</p>
                        {c.details.map(([k, v]) => (
                          <div className="class-info-row" key={k}><span>{k}</span><strong>{v}</strong></div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {hasZumba && (
                  <>
                    <div className={`form-group${ePlan ? ' has-error' : ''}`} data-field="feePlan">
                      <label>Zumba Plan * <span className="label-hint">— classes per week</span></label>
                      <CustomSelect
                        value={formData.feePlan}
                        onChange={handleSelectChange('feePlan')}
                        options={zumbaInfo.plans.map(pl => ({ value: pl.value, label: pl.label, sub: formatRupees(pl.fee) }))}
                        placeholder="Select 5 or 3 classes"
                        title="Zumba Plan"
                        hasError={!!ePlan}
                        describedBy="err-feePlan"
                      />
                      <FieldError field="feePlan" message={ePlan} />
                    </div>
                    <div className={`form-group${eBatch ? ' has-error' : ''}`} data-field="zumbaBatch">
                      <label>Zumba Batch *</label>
                      <CustomSelect
                        value={formData.zumbaBatch}
                        onChange={handleSelectChange('zumbaBatch')}
                        options={zumbaInfo.batches.map(bt => ({ value: bt, label: bt }))}
                        placeholder="Select Batch"
                        title="Zumba Batch"
                        hasError={!!eBatch}
                        describedBy="err-zumbaBatch"
                      />
                      <FieldError field="zumbaBatch" message={eBatch} />
                    </div>
                  </>
                )}

                {needsSchedule && (
                  <div className={`form-group full-width${eSched ? ' has-error' : ''}`} data-field="classSchedule">
                    <label>Class Schedule *</label>
                    <CustomSelect
                      value={formData.classSchedule}
                      onChange={handleSelectChange('classSchedule')}
                      options={scheduleOptions}
                      placeholder="Select Schedule"
                      title="Select Schedule"
                      hasError={!!eSched}
                      describedBy="err-classSchedule"
                    />
                    <FieldError field="classSchedule" message={eSched} />
                  </div>
                )}

                <div className={`form-group full-width${eRef && refCheck.state !== 'typing' ? ' has-error' : ''}`} data-field="referralCode">
                  <label htmlFor="reg-ref">Referral Code <span className="label-hint">— optional, if a friend referred you</span></label>
                  <input
                    id="reg-ref"
                    type="text"
                    name="referralCode"
                    value={formData.referralCode}
                    onChange={(e) => { setFormData(prev => ({ ...prev, referralCode: e.target.value.toUpperCase() })); clearServerError('referralCode'); }}
                    onBlur={onReferralBlur}
                    placeholder="e.g. KJ7QH4MZ"
                    autoCapitalize="characters"
                    autoComplete="off"
                    maxLength={14}
                    aria-describedby="ref-status"
                  />
                  <div id="ref-status">
                    {refCheck.state === 'typing' && <p className="ref-status ref-status--checking">Codes have {REFERRAL_CODE_LENGTH} characters, like KJ7QH4MZ.</p>}
                    {refCheck.state === 'checking' && <p className="ref-status ref-status--checking">Checking the code…</p>}
                    {refCheck.state === 'valid' && <p className="ref-status ref-status--valid">✓ Code accepted — referred by {refCheck.referrerName}</p>}
                    {refCheck.state === 'invalid' && (
                      <p className="ref-status ref-status--invalid">
                        ✕ {refCheck.problem?.title || 'This code cannot be used'}.{' '}
                        <button type="button" className="ref-why" onClick={() => setRefPopup(refCheck.problem)}>See why and what to do</button>
                      </p>
                    )}
                    {refCheck.state === 'typing' && eRef && (touched.referralCode || submitAttempted) && (
                      <p className="field-error" role="alert"><AlertTriangle size={13} /> {eRef}</p>
                    )}
                    {serverErrors.referralCode && refCheck.state !== 'invalid' && <FieldError field="referralCode" message={serverErrors.referralCode} />}
                  </div>
                </div>

                {entries.length > 0 && (
                  <div className="form-group full-width">
                    <div className="fee-summary">
                      <p className="fee-summary__title">Fee Details</p>
                      {entries.map(e => (
                        <div className="fee-summary__row" key={e.classType}>
                          <span>
                            {e.classType}
                            {e.feePlan && <em> · {e.feePlan.replace(' Class', '')} classes / week</em>}
                          </span>
                          <strong>{e.classType === ZUMBA_CLASS && !e.feePlan ? 'Choose plan' : formatRupees(e.fee)}</strong>
                        </div>
                      ))}
                      <div className="fee-summary__row fee-summary__total">
                        <span>Total per month</span>
                        <strong>{priceKnown ? formatRupees(totalFee) : '—'}</strong>
                      </div>
                      {entries.length > 1 && (
                        <p className="fee-summary__offer">
                          🎁 Joining more than one class? The studio may give you a special offer on this fee —
                          it is confirmed when your registration is accepted.
                        </p>
                      )}
                      {dependsOnAge && (
                        <p className="fee-summary__note">Regular and Online class fees depend on age — enter the age to see the exact fee.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

          </div>

          <div className="form-footer">
            {showSummary && (
              <button type="button" className="form-hint form-hint--button" onClick={() => focusField(orderedProblems[0].field)}>
                ⚠ {orderedProblems.length === 1 ? '1 thing to fix' : `${orderedProblems.length} things to fix`} — tap to see {orderedProblems.length === 1 ? 'it' : 'the first'}
              </button>
            )}
            {!isCamp && (
              <div className="fee-bar">
                <span>{entries.length > 1 ? `${entries.length} classes · per month` : 'Fee per month'}</span>
                <strong>{entries.length === 0 ? '—' : priceKnown ? formatRupees(totalFee) : 'Choose Zumba plan'}</strong>
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : isCamp ? 'Register for Camp' : 'Submit Registration'}
            </button>
          </div>
        </form>
      </div>

      {refPopup && (
        <div className="ref-popup-overlay" role="dialog" aria-modal="true" aria-labelledby="ref-popup-title">
          <div className="ref-popup">
            <div className="ref-popup__icon"><AlertTriangle size={26} /></div>
            <h3 id="ref-popup-title">{refPopup.title}</h3>
            <p>{refPopup.message}</p>
            {refPopup.steps?.length > 0 && (
              <>
                <p className="ref-popup__what">What you can do:</p>
                <ol>{refPopup.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              </>
            )}
            <div className="ref-popup__actions">
              <button type="button" onClick={() => { setRefPopup(null); setFormData(prev => ({ ...prev, referralCode: '' })); setServerErrors(prev => ({ ...prev, referralCode: undefined })); setRefCheck({ state: 'idle' }); }}>
                Continue without a code
              </button>
              <button type="button" className="primary" onClick={() => { setRefPopup(null); setTimeout(() => focusField('referralCode'), 50); }}>
                Fix the code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
