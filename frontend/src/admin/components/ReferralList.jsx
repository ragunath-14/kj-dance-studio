import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Search, Copy, Check, RefreshCw, Gift, Eye, Plus } from 'lucide-react';
import API_URL from '../config';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import Pagination from './Pagination';
import './List.css';
import './ReferralList.css';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const STATUS_LABEL = { approved: 'Accepted', pending: 'Waiting for you', rejected: 'Rejected' };

// Admin module: every student's referral code, its history, the friends it brought in, and regenerate / generate.
const ReferralList = () => {
  const [filter, setFilter] = useState('withCode');          // withCode | noCode | all
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [result, setResult] = useState({ data: [], total: 0, totalPages: 1, counts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);                 // { type: 'success' | 'error', text }
  const [copied, setCopied] = useState('');
  const [details, setDetails] = useState(null);               // { loading, data }
  const [confirm, setConfirm] = useState(null);               // row waiting for "Regenerate" confirmation
  const [busyId, setBusyId] = useState(null);
  const reqSeq = useRef(0);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [filter]);
  useEffect(() => { if (!notice) return undefined; const t = setTimeout(() => setNotice(null), 8000); return () => clearTimeout(t); }, [notice]);

  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    try {
      const res = await axios.get(`${API_URL}/referrals`, { params: { filter, search: debounced, page, limit } });
      if (seq !== reqSeq.current) return;                       // a newer request is already on its way
      setResult(res.data);
      setError('');
    } catch (err) {
      if (seq !== reqSeq.current) return;
      setError(err.response?.data?.message || 'Could not load the referral codes. Please try again.');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [filter, debounced, page, limit]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const copy = async (code) => {
    try { await navigator.clipboard.writeText(code); } catch { /* the code is on screen to copy by hand */ }
    setCopied(code);
    setTimeout(() => setCopied(''), 1800);
  };

  const openDetails = async (row) => {
    setDetails({ loading: true, row, data: null });
    try {
      const res = await axios.get(`${API_URL}/referrals/${row._id}`);
      setDetails({ loading: false, row, data: res.data });
    } catch (err) {
      setDetails(null);
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not load the details.' });
    }
  };

  const generate = async (row) => {
    setBusyId(row._id);
    try {
      const res = await axios.post(`${API_URL}/referrals/${row._id}/generate`);
      setNotice({ type: 'success', text: `Code ${res.data.referralCode} created for ${row.studentName}.` });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not create the code.' });
    } finally { setBusyId(null); }
  };

  const regenerate = async () => {
    const row = confirm;
    setConfirm(null);
    setBusyId(row._id);
    try {
      const res = await axios.post(`${API_URL}/referrals/${row._id}/regenerate`);
      setNotice({
        type: 'success',
        text: res.data.previousCode
          ? `New code ${res.data.referralCode} created for ${row.studentName}. The old code ${res.data.previousCode} has expired.`
          : `Code ${res.data.referralCode} created for ${row.studentName}.`
      });
      await load();
      if (details?.row?._id === row._id) openDetails(row);
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not create a new code.' });
    } finally { setBusyId(null); }
  };

  const counts = result.counts || {};
  const tabLabel = (key, label) => `${label} (${counts[key] ?? '…'})`;

  return (
    <div className="student-list animate-fade-in referral-admin">
      <div className="list-header">
        <div className="header-left-group">
          <div className="search-box">
            <Search size={18} />
            <input type="text" placeholder="Search name, phone or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="tabs">
            <button className={`tab-btn ${filter === 'withCode' ? 'active' : ''}`} onClick={() => setFilter('withCode')}>{tabLabel('withCode', 'With code')}</button>
            <button className={`tab-btn ${filter === 'noCode' ? 'active' : ''}`} onClick={() => setFilter('noCode')}>{tabLabel('noCode', 'No code yet')}</button>
            <button className={`tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>{tabLabel('all', 'All')}</button>
          </div>
        </div>
      </div>

      <p className="referral-admin-help">
        <Gift size={16} />
        <span>
          Each student gets one code. A friend who registers with it earns the student <b>{result.percent || 10}% off one monthly bill</b> —
          but only once <b>you accept</b> the friend. <b>Regenerate</b> expires the old code at once and makes a new one.
        </span>
      </p>

      {notice && <div className={`referral-admin-notice ${notice.type}`}>{notice.type === 'success' ? '✅' : '❌'} {notice.text}</div>}
      {error && <div className="referral-admin-notice error">❌ {error}</div>}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Phone</th>
              <th>Referral code</th>
              <th>Created</th>
              <th>Friends</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && result.data.length === 0 ? (
              <tr><td colSpan="6" className="text-center">Loading…</td></tr>
            ) : result.data.length === 0 ? (
              <tr><td colSpan="6" className="text-center">
                {debounced ? 'No student matches this search.' : filter === 'noCode' ? 'Every student already has a code.' : 'No referral codes yet. Students create theirs on the website, or use Generate on the “No code yet” tab.'}
              </td></tr>
            ) : result.data.map((row) => (
              <tr key={row._id}>
                <td data-label="Student">
                  <div><strong>{row.studentName}</strong></div>
                  <div className="referral-admin-classes">
                    {row.classes.map(c => <span key={c} className="mini-badge schedule-badge weekday">{c.replace(' Class', '')}</span>)}
                    {!row.isActive && <span className="mini-badge inactive-badge">Inactive</span>}
                  </div>
                </td>
                <td data-label="Phone">{row.phone}</td>
                <td data-label="Referral code">
                  {row.referralCode ? (
                    <div className="referral-admin-code">
                      <code>{row.referralCode}</code>
                      <button type="button" className="referral-admin-copy" onClick={() => copy(row.referralCode)} title="Copy code">
                        {copied === row.referralCode ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  ) : <span className="text-muted">No code yet</span>}
                  {row.expiredCodes > 0 && <div className="referral-admin-sub">{row.expiredCodes} old code{row.expiredCodes > 1 ? 's' : ''} expired</div>}
                </td>
                <td data-label="Created">{fmtDate(row.referralCodeCreatedAt)}</td>
                <td data-label="Friends">
                  <span className="mini-badge paid">{row.friendsAccepted} accepted</span>
                  {row.friendsWaiting > 0 && <span className="mini-badge unpaid">{row.friendsWaiting} waiting</span>}
                </td>
                <td data-label="Actions">
                  <div className="action-buttons">
                    <div className="icon-actions-group">
                      <button type="button" className="referral-admin-btn" onClick={() => openDetails(row)} title="View history and friends"><Eye size={16} /> Details</button>
                      {row.referralCode ? (
                        <button type="button" className="referral-admin-btn danger" disabled={busyId === row._id || !row.isActive} onClick={() => setConfirm(row)} title={row.isActive ? 'Expire this code and make a new one' : 'Reactivate the student first'}>
                          <RefreshCw size={16} /> {busyId === row._id ? '…' : 'Regenerate'}
                        </button>
                      ) : (
                        <button type="button" className="referral-admin-btn primary" disabled={busyId === row._id || !row.isActive} onClick={() => generate(row)} title={row.isActive ? 'Create the first code' : 'Reactivate the student first'}>
                          <Plus size={16} /> {busyId === row._id ? '…' : 'Generate'}
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalItems={result.total || 0}
        itemsPerPage={limit}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      <ConfirmDialog
        isOpen={!!confirm}
        title="Regenerate referral code?"
        message={confirm ? `${confirm.studentName}'s current code ${confirm.referralCode} will EXPIRE immediately and stop working for new sign-ups. A new code will be created. Friends who already registered with the old code are still rewarded when you accept them.` : ''}
        confirmText="Yes, regenerate"
        cancelText="Cancel"
        danger
        onConfirm={regenerate}
        onCancel={() => setConfirm(null)}
      />

      <Modal isOpen={!!details} onClose={() => setDetails(null)} title="Referral details" width="680px">
        {details && (details.loading ? <p>Loading…</p> : (() => {
          const d = details.data;
          return (
            <div className="referral-details">
              <p className="referral-details-name"><strong>{d.student.studentName}</strong> <span>· {d.student.phone} · {d.student.classes.join(', ')}</span></p>

              <div className="referral-details-current">
                <small>Current code</small>
                {d.referralCode ? (<><code>{d.referralCode}</code><span>Created {fmtDate(d.referralCodeCreatedAt)}</span></>) : <span>No code yet</span>}
              </div>

              <h4>Old codes (expired)</h4>
              {d.history.length === 0 ? <p className="referral-details-empty">None — this student has never regenerated their code.</p> : (
                <table className="referral-details-table">
                  <thead><tr><th>Code</th><th>Created</th><th>Expired</th><th>By</th></tr></thead>
                  <tbody>{d.history.map(h => (
                    <tr key={h.code}><td><code>{h.code}</code></td><td>{fmtDate(h.createdAt)}</td><td>{fmtDate(h.expiredAt)}</td><td>{h.expiredBy === 'admin' ? 'Admin' : 'Student'}</td></tr>
                  ))}</tbody>
                </table>
              )}

              <h4>Friends who registered with this student's codes</h4>
              {d.friends.length === 0 ? <p className="referral-details-empty">No friend has used a code yet.</p> : (
                <table className="referral-details-table">
                  <thead><tr><th>Friend</th><th>Registered</th><th>Status</th><th>Code used</th></tr></thead>
                  <tbody>{d.friends.map(f => (
                    <tr key={f._id}>
                      <td>{f.name}<br /><small>{f.phone}</small></td>
                      <td>{fmtDate(f.registeredAt)}</td>
                      <td>
                        <span className={`referral-status referral-status--${f.status}`}>{STATUS_LABEL[f.status] || f.status}</span>
                        {f.note && <div className="referral-details-note">{f.note}</div>}
                      </td>
                      <td><code>{f.codeUsed}</code>{f.codeExpiredNow && <div className="referral-details-note">expired since</div>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}

              {d.rewards.length > 0 && (<>
                <h4>Rewards given</h4>
                <ul className="referral-details-rewards">{d.rewards.map((r, i) => <li key={i}><b>{r.percent}% off</b> the {r.bill} bill — {r.friend} joined</li>)}</ul>
              </>)}

              <div className="referral-details-actions">
                {d.student.isActive && d.referralCode && (
                  <button type="button" className="referral-admin-btn danger" onClick={() => setConfirm({ ...details.row, referralCode: d.referralCode })}><RefreshCw size={16} /> Regenerate code</button>
                )}
                {d.student.isActive && !d.referralCode && (
                  <button type="button" className="referral-admin-btn primary" onClick={() => { const row = details.row; setDetails(null); generate(row); }}><Plus size={16} /> Generate code</button>
                )}
              </div>
            </div>
          );
        })())}
      </Modal>
    </div>
  );
};

export default ReferralList;
