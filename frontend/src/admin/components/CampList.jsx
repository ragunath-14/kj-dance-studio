import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Navigate } from 'react-router-dom';
import { Search, Trash2, UserCheck, CheckCircle, Send } from 'lucide-react';
import API_URL from '../config';
import { useData } from '../context/DataContext';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import Button from './ui/Button';
import SkeletonRow from './ui/SkeletonRow';
import Pagination from './Pagination';
import './List.css';
import './CampList.css';

const CLASS_TYPES = ['Regular Class', 'Fitness Class', 'Online Class'];
const SCHEDULES = [
  { value: 'Weekday', label: 'Weekday' },
  { value: 'Weekend', label: 'Weekend' },
  { value: 'NA',      label: 'Not set' },
];
const DEFAULT_CONVERT = { classType: 'Regular Class', classSchedule: 'NA' };

const CampRegistrations = () => {
  const { dataVersion } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [list, setList] = useState({ data: [], total: 0, counts: { registered: 0, accepted: 0, converted: 0, total: 0 } });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [convertTarget, setConvertTarget] = useState(null);
  const [convertForm, setConvertForm] = useState(DEFAULT_CONVERT);
  const [converting, setConverting] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const latestRequest = useRef(0);

  const showFeedback = (message, type = 'error') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 4000);
  };

  // Debounce only the search box — tab/filter changes fetch instantly
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchCamp = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/camp`, {
        params: { page, limit, search: debouncedSearch, studentCategory: category, status }
      });
      if (requestId === latestRequest.current) setList(res.data);
    } catch (err) {
      console.error('Camp registrations fetch failed:', err);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [page, limit, debouncedSearch, category, status]);

  // dataVersion bumps whenever the server reports a change (new sign-up, conversion…)
  useEffect(() => {
    fetchCamp();
  }, [fetchCamp, dataVersion]);

  const changeStatus   = (s) => { setStatus(s);   setPage(1); };
  const changeCategory = (c) => { setCategory(c); setPage(1); };

  const openConvert = (reg) => {
    setConvertTarget(reg);
    setConvertForm(DEFAULT_CONVERT);
  };

  const handleConvert = async () => {
    const reg = convertTarget;
    setConverting(true);
    try {
      await axios.post(`${API_URL}/camp/${reg._id}/convert`, convertForm);
      showFeedback(`${reg.studentName} is now a regular student.`, 'success');
    } catch (err) {
      // 409 = student already exists; the server still marks the registration converted
      showFeedback(err.response?.data?.message || 'Failed to convert registration.');
    } finally {
      setConverting(false);
      setConvertTarget(null);
      fetchCamp();
    }
  };

  const handleAccept = async (reg) => {
    setAcceptingId(reg._id);
    try {
      await axios.post(`${API_URL}/camp/${reg._id}/accept`);
      showFeedback(`${reg.studentName}'s camp seat is confirmed — WhatsApp message sent.`, 'success');
    } catch (err) {
      showFeedback(err.response?.data?.message || 'Failed to accept registration.');
    } finally {
      setAcceptingId(null);
      fetchCamp();
    }
  };

  const executeDelete = async () => {
    const id = deleteConfirm.id;
    setDeleteConfirm({ open: false, id: null });
    try {
      await axios.delete(`${API_URL}/camp/${id}`);
      fetchCamp();
    } catch (err) {
      showFeedback(err.response?.data?.message || 'Failed to delete registration.');
    }
  };

  const counts = list.counts || { registered: 0, accepted: 0, converted: 0, total: 0 };
  const statusTabs = [
    { value: '',           label: `All (${counts.total})` },
    { value: 'registered', label: `Registered (${counts.registered})` },
    { value: 'accepted',   label: `Accepted (${counts.accepted})` },
    { value: 'converted',  label: `Converted (${counts.converted})` },
  ];

  return (
    <div className="camp-list animate-fade-in">
      <div className="list-header">
        <div className="header-left-group">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search camp registrations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="tabs">
            {statusTabs.map(t => (
              <button
                key={t.value || 'all'}
                className={`tab-btn ${status === t.value ? 'active' : ''}`}
                onClick={() => changeStatus(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="schedule-filter-tabs">
            {[['', 'All Ages'], ['Kids', 'Kids'], ['Adults', 'Adults']].map(([value, label]) => (
              <button
                key={value || 'all'}
                className={`schedule-filter-btn ${category === value ? 'active' : ''}`}
                onClick={() => changeCategory(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {feedback.message && (
        <div className={`camp-feedback ${feedback.type}`}>
          {feedback.type === 'success' ? '✅' : '❌'} {feedback.message}
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact Details</th>
              <th>Age / Gender</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && list.data.length === 0 ? (
              <>
                <SkeletonRow columns={5} />
                <SkeletonRow columns={5} />
                <SkeletonRow columns={5} />
              </>
            ) : list.data.length > 0 ? (
              list.data.map((reg) => (
                <tr key={reg._id}>
                  <td data-label="Student">
                    <div className="student-name-cell">
                      <strong>{reg.studentName}</strong>
                      <div className="badge-row">
                        {reg.status === 'converted' ? (
                          <span className="mini-badge paid"><CheckCircle size={12} /> Converted</span>
                        ) : reg.status === 'accepted' ? (
                          <span className="mini-badge camp-accepted"><CheckCircle size={12} /> Accepted</span>
                        ) : (
                          <span className="mini-badge camp-registered">Registered</span>
                        )}
                        <span className="mini-badge schedule-badge weekday">{reg.studentCategory}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Contact">
                    <div className="contact-info">
                      <span className="phone">P: {reg.phone}</span>
                      {reg.whatsappNumber && reg.whatsappNumber !== reg.phone && (
                        <span className="phone">W: {reg.whatsappNumber}</span>
                      )}
                    </div>
                  </td>
                  <td data-label="Age / Gender">
                    <span className="join-date">
                      {[reg.studentAge && `${reg.studentAge} yrs`, reg.gender].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </td>
                  <td data-label="Registered">
                    <span className="join-date">{new Date(reg.createdAt).toLocaleDateString('en-GB')}</span>
                  </td>
                  <td data-label="Actions">
                    <div className="action-buttons">
                      {reg.status === 'registered' && (
                        <button
                          className="camp-accept-btn"
                          onClick={() => handleAccept(reg)}
                          disabled={acceptingId === reg._id}
                        >
                          <Send size={15} /> {acceptingId === reg._id ? 'Accepting...' : 'Accept'}
                        </button>
                      )}
                      {reg.status === 'accepted' && (
                        <button className="camp-convert-btn" onClick={() => openConvert(reg)}>
                          <UserCheck size={15} /> Convert to Student
                        </button>
                      )}
                      {reg.status === 'converted' && (
                        <span className="text-muted">Now a student</span>
                      )}
                      <div className="icon-actions-group">
                        <Button
                          variant="icon"
                          className="delete"
                          onClick={() => setDeleteConfirm({ open: true, id: reg._id })}
                          icon={Trash2}
                          title="Delete Registration"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center">
                  {loading ? 'Refreshing...' : 'No camp registrations found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={list.page || page}
        totalItems={list.total || 0}
        itemsPerPage={list.limit || limit}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      <Modal
        isOpen={!!convertTarget}
        onClose={() => !converting && setConvertTarget(null)}
        title="Convert to Regular Student"
        width="480px"
      >
        {convertTarget && (
          <div className="camp-convert-form">
            <p className="camp-convert-intro">
              <strong>{convertTarget.studentName}</strong> will move to the Students list as a regular
              class student, and normal monthly fee tracking starts from today.
            </p>

            <label className="camp-convert-label">Class</label>
            <div className="camp-option-row">
              {CLASS_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  className={`camp-option ${convertForm.classType === type ? 'selected' : ''}`}
                  onClick={() => setConvertForm(f => ({ ...f, classType: type }))}
                >
                  {type.replace(' Class', '')}
                </button>
              ))}
            </div>

            <label className="camp-convert-label">Schedule</label>
            <div className="camp-option-row">
              {SCHEDULES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  className={`camp-option ${convertForm.classSchedule === s.value ? 'selected' : ''}`}
                  onClick={() => setConvertForm(f => ({ ...f, classSchedule: s.value }))}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="camp-convert-actions">
              <Button variant="secondary" onClick={() => setConvertTarget(null)} disabled={converting}>Cancel</Button>
              <Button onClick={handleConvert} disabled={converting} icon={UserCheck}>
                {converting ? 'Converting...' : 'Convert'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        title="Delete Camp Registration"
        message="Are you sure you want to delete this camp registration? If it was already converted, the student record is kept."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        danger={true}
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </div>
  );
};

// The whole module disappears when the admin switches camp registration off
const CampList = () => {
  const { settings } = useData();
  if (!settings.loaded) return <div className="loading-state">Loading...</div>;
  if (!settings.campEnabled) return <Navigate to="/admin" replace />;
  return <CampRegistrations />;
};

export default CampList;
