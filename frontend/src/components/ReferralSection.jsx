import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Gift, Search, Copy, Check, Share2, UserCheck, RefreshCw } from 'lucide-react';
import './ReferralSection.css';

const PERCENT = 10;

// Landing-page "Refer & Earn": a student finds their record by phone number, creates their
// referral code and shares it. New students enter the code on the registration form.
const ReferralSection = ({ onRegister }) => {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState({ status: 'idle', students: [], pending: false, error: '' }); // idle | loading | done
  const [busyId, setBusyId] = useState(null);
  const [copied, setCopied] = useState('');
  const [confirmFor, setConfirmFor] = useState(null);   // student who is about to replace their code
  const [renewed, setRenewed] = useState({});             // id -> { oldCode, newCode } shown after a replacement

  const [suggestions, setSuggestions] = useState([]);

  const digits = phone.replace(/\D/g, '').slice(-10);

  // While the visitor types 5-9 digits, show which students match (contact OR WhatsApp number)
  useEffect(() => {
    const typed = phone.replace(/\D/g, '');
    if (typed.length < 5 || typed.length > 12 || state.status === 'done') { setSuggestions([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await axios.post('/api/referral/suggest', { phone });
        if (!cancelled) setSuggestions(res.data.suggestions || []);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phone, state.status]);

  const find = async (e) => {
    e?.preventDefault();
    if (digits.length !== 10) {
      setState({ status: 'idle', students: [], pending: false, error: 'Please enter a valid 10-digit phone number.' });
      return;
    }
    setState({ status: 'loading', students: [], pending: false, error: '' });
    try {
      const res = await axios.post('/api/referral/lookup', { phone });
      setState({ status: 'done', students: res.data.students || [], pending: !!res.data.pending, error: '' });
    } catch (err) {
      setState({ status: 'idle', students: [], pending: false, error: err.response?.data?.message || 'Could not look this up right now. Please try again.' });
    }
  };

  const generate = async (student) => {
    setBusyId(student.id);
    try {
      const res = await axios.post('/api/referral/generate', { studentId: student.id, phone });
      setState(prev => ({ ...prev, error: '', students: prev.students.map(s => s.id === student.id ? { ...s, referralCode: res.data.referralCode } : s) }));
    } catch (err) {
      setState(prev => ({ ...prev, error: err.response?.data?.message || 'Could not create the code. Please try again.' }));
    } finally {
      setBusyId(null);
    }
  };

  // Replaces the code: the old one expires at once. Only after the student confirmed in the dialog.
  const regenerate = async () => {
    const student = confirmFor;
    setConfirmFor(null);
    setBusyId(student.id);
    try {
      const res = await axios.post('/api/referral/regenerate', { studentId: student.id, phone });
      setRenewed(prev => ({ ...prev, [student.id]: { oldCode: res.data.previousCode, newCode: res.data.referralCode } }));
      setState(prev => ({ ...prev, error: '', students: prev.students.map(s => s.id === student.id
        ? { ...s, referralCode: res.data.referralCode, referralCodeCreatedAt: new Date().toISOString(), expiredCodes: (s.expiredCodes || 0) + 1 } : s) }));
    } catch (err) {
      setState(prev => ({ ...prev, error: err.response?.data?.message || 'Could not create a new code. Please try again.' }));
    } finally {
      setBusyId(null);
    }
  };

  const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

  const shareLink = (code) => `${window.location.origin}/?ref=${code}`;

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard blocked: the code is shown on screen to copy by hand */
    }
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  const whatsappShare = (code) => {
    const text = `Join KJ Academy! Register with my referral code ${code} and get started: ${shareLink(code)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  return (
    <section id="referral" className="section-padding referral-section">
      <div className="container">
        <div className="text-center">
          <h2 className="section-title">Refer a Friend <span className="highlight">&amp; Save</span></h2>
          <p className="section-sub">
            Give your friends your code. When the studio accepts a new student who used it, you get <b>{PERCENT}% off</b> a monthly bill —
            <b> 2 friends = {PERCENT * 2}% off</b>, and so on.
          </p>
        </div>

        <div className="referral-steps">
          <div><span>1</span> Enter your phone number</div>
          <div><span>2</span> Generate your code</div>
          <div><span>3</span> Friends enter it when they register</div>
        </div>

        <form className="referral-lookup" onSubmit={find}>
          <div className="referral-input">
            <Search size={18} />
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Your registered phone number"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); if (state.status === 'done') setState({ status: 'idle', students: [], pending: false, error: '' }); }}
              maxLength={16}
            />
          </div>
          <button type="submit" className="referral-find" disabled={state.status === 'loading'}>
            {state.status === 'loading' ? 'Searching…' : 'Find my account'}
          </button>
        </form>

        {suggestions.length > 0 && digits.length < 10 && (
          <div className="referral-suggestions" role="status" aria-live="polite">
            <p className="referral-suggestions-title">Is this you? Keep typing your full 10-digit number.</p>
            {suggestions.map((s, i) => (
              <div className="referral-suggestion" key={i}>
                <UserCheck size={18} />
                <div>
                  <b>{s.name}</b>
                  <span>{s.classes.join(' · ')}</span>
                  <small>
                    {s.matched === 'whatsapp' ? 'WhatsApp number' : 'Contact number'} {s.maskedPhone}
                    {s.otherNumber ? ' · this student has two numbers, either one works' : ''}
                  </small>
                </div>
              </div>
            ))}
          </div>
        )}

        {state.error && <p className="referral-error">{state.error}</p>}

        {state.status === 'done' && state.students.length === 0 && (
          <div className="referral-empty">
            {state.pending ? (
              <p>Your registration is <b>waiting for the studio to accept it</b>. Once it is accepted you can create your referral code here.</p>
            ) : (
              <>
                <p>We couldn’t find an accepted student with this number. Referral codes are for students already enrolled at the studio.</p>
                <button type="button" onClick={() => onRegister()}>Register now</button>
              </>
            )}
          </div>
        )}

        {state.students.length > 0 && (
          <div className="referral-results">
            {state.students.length > 1 && <p className="referral-note">More than one student uses this number — choose the right one.</p>}
            {state.students.map(s => (
              <div className="referral-card" key={s.id}>
                <div className="referral-card-head">
                  <div className="referral-avatar"><UserCheck size={22} /></div>
                  <div>
                    <h3>{s.studentName}</h3>
                    <p>{s.classes.join(' · ')}</p>
                  </div>
                  <span className={`referral-badge ${s.isActive ? 'on' : 'off'}`}>{s.isActive ? 'Active student' : 'Inactive'}</span>
                </div>

                {!s.isActive ? (
                  <p className="referral-note">This account is inactive. Please contact the studio to reactivate it before referring friends.</p>
                ) : s.referralCode ? (
                  <>
                    {renewed[s.id] && (
                      <div className="referral-renewed">
                        ✅ Your new code is ready. The old code <b>{renewed[s.id].oldCode}</b> has expired — share the new one below.
                      </div>
                    )}
                    <div className="referral-code">
                      <small>Your referral code</small>
                      <strong>{s.referralCode}</strong>
                      {s.referralCodeCreatedAt && <span className="referral-code-date">Created on {fmt(s.referralCodeCreatedAt)}{s.expiredCodes > 0 ? ` · ${s.expiredCodes} older code${s.expiredCodes > 1 ? 's have' : ' has'} expired` : ''}</span>}
                      <div className="referral-actions">
                        <button type="button" onClick={() => copy(s.referralCode)}>
                          {copied === s.referralCode ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
                        </button>
                        <button type="button" className="wa" onClick={() => whatsappShare(s.referralCode)}>
                          <Share2 size={16} /> Share on WhatsApp
                        </button>
                      </div>
                    </div>
                    <button type="button" className="referral-renew" disabled={busyId === s.id} onClick={() => setConfirmFor(s)}>
                      <RefreshCw size={15} /> {busyId === s.id ? 'Creating…' : 'Get a new code (the old one expires)'}
                    </button>
                    <div className="referral-stats">
                      <div><b>{s.referralsAccepted}</b><span>friends joined</span></div>
                      <div>
                        {s.upcomingRewards.length > 0
                          ? s.upcomingRewards.map(r => <p key={r.month}><b>{r.percent}% off</b> your {r.month} bill</p>)
                          : <p>No reward yet — it appears here when a friend you referred is accepted.</p>}
                      </div>
                    </div>
                  </>
                ) : (
                  <button type="button" className="referral-generate" onClick={() => generate(s)} disabled={busyId === s.id}>
                    <Gift size={18} /> {busyId === s.id ? 'Creating…' : 'Generate Referral Code'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmFor && (
        <div className="referral-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="referral-renew-title">
          <div className="referral-modal">
            <h3 id="referral-renew-title">Make a new code?</h3>
            <p>Your current code <b>{confirmFor.referralCode}</b> will <b>stop working right away</b>.</p>
            <ul>
              <li>Friends must use your <b>new</b> code when they register.</li>
              <li>Friends who already registered with the old code are still counted when the studio accepts them.</li>
              <li>This cannot be undone.</li>
            </ul>
            <div className="referral-modal-actions">
              <button type="button" onClick={() => setConfirmFor(null)}>Keep my current code</button>
              <button type="button" className="primary" onClick={regenerate}>Yes, make a new code</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ReferralSection;
