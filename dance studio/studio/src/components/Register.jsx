import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { User, Phone, MessageCircle, Calendar, Users, ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react';
import './Register.css';

/* ─── Custom Dropdown (replaces native <select> to fix overflow clipping) ─── */
const CustomSelect = ({ value, onChange, options, placeholder, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className={`custom-select${open ? ' open' : ''}${disabled ? ' disabled' : ''}`} ref={ref}>
      <button
        type="button"
        className="custom-select__trigger"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        <span className={selected ? 'custom-select__value' : 'custom-select__placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className="custom-select__chevron" />
      </button>

      {open && (
        <ul className="custom-select__menu">
          {options.map(opt => (
            <li
              key={opt.value}
              className={`custom-select__option${opt.value === value ? ' selected' : ''}`}
              onMouseDown={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────────── */
const Register = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    studentName: '',
    studentCategory: '',
    studentAge: '',
    gender: '',
    classType: 'Regular Class',
    danceForFitness: '',
    whatsappNumber: '',
    phone: '',
  });

  const [activeStep, setActiveStep] = useState(1);
  const [isSameNumber, setIsSameNumber] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(isSameNumber && name === 'phone' ? { whatsappNumber: value } : {})
    }));
  };

  // Used by CustomSelect — takes field name + value directly
  const handleSelectChange = (name) => (value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSameNumber = () => {
    const next = !isSameNumber;
    setIsSameNumber(next);
    if (next) setFormData(prev => ({ ...prev, whatsappNumber: prev.phone }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeStep < 2) { setActiveStep(2); return; }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5001/api' : '/api';
      const res = await axios.post(`${API_BASE}/register`, formData);

      if (res.data.success) {
        setMessage({ type: 'success', text: 'Registration submitted successfully! We will contact you soon.' });
        setFormData({
          studentName: '', studentCategory: '', studentAge: '', gender: '',
          classType: 'Regular Class', danceForFitness: '', whatsappNumber: '', phone: ''
        });
        setIsSameNumber(false);
        setTimeout(onClose, 3000);
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to submit registration. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  /* Option lists */
  const genderOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
  ];
  const categoryOptions = [
    { value: 'Adults', label: 'Adults' },
    { value: 'Kids', label: 'Kids' },
  ];

  return (
    <div className="register-modal-overlay">
      <div className="register-modal animate-fade-in">
        <button className="close-btn" onClick={onClose}>&times;</button>

        <div className="register-header">
          <h2>Student Registration</h2>
          <p>Join the KJ Dance Studio family today!</p>
        </div>

        {message.text && (
          <div className={`message-banner ${message.type}`}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}

        <div className="registration-tabs">
          {[{ n: 1, label: 'Details' }, { n: 2, label: 'Class' }].map(({ n, label }) => (
            <div
              key={n}
              className={`tab-item ${activeStep === n ? 'active' : ''} ${activeStep > n ? 'completed' : ''}`}
              onClick={() => setActiveStep(n)}
            >
              <span className="step-num">{n}</span>
              <span className="step-label">{label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="register-form">

          {/* ── Step 1: Student Details ── */}
          {activeStep === 1 && (
            <div className="form-step animate-slide-in">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label><User size={12} /> Full Name *</label>
                  <input type="text" name="studentName" value={formData.studentName} onChange={handleChange} required placeholder="Student Name" />
                </div>

                <div className="form-group">
                  <label><Phone size={12} /> Phone Number *</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleChange} required placeholder="Contact Number" />
                </div>

                <div className="form-group">
                  <div className="label-with-action">
                    <label><MessageCircle size={12} /> WhatsApp Number</label>
                    <div className={`same-as-badge ${isSameNumber ? 'active' : ''}`} onClick={handleSameNumber}>
                      <span>Same as phone</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    name="whatsappNumber"
                    value={formData.whatsappNumber}
                    onChange={handleChange}
                    placeholder="WhatsApp Number"
                    disabled={isSameNumber}
                  />
                </div>

                <div className="form-group">
                  <label><Calendar size={12} /> Age</label>
                  <input type="text" name="studentAge" value={formData.studentAge} onChange={handleChange} placeholder="Age" />
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

                <div className="form-group full-width">
                  <label><Users size={12} /> Student Category *</label>
                  <CustomSelect
                    value={formData.studentCategory}
                    onChange={handleSelectChange('studentCategory')}
                    options={categoryOptions}
                    placeholder="Select Category"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Class Details ── */}
          {activeStep === 2 && (
            <div className="form-step animate-slide-in">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Class Type *</label>
                  <div className="class-type-selector">
                    {['Regular Class', 'Fitness Class'].map(type => (
                      <div
                        key={type}
                        className={`type-option ${formData.classType === type ? 'selected' : ''}`}
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          classType: type
                        }))}
                      >
                        {type}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="form-footer">
            {activeStep > 1 && (
              <button type="button" className="btn-secondary" onClick={() => setActiveStep(1)}>
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {activeStep < 2 ? (
              <button type="button" className="btn-primary" onClick={() => setActiveStep(2)}>
                Continue <ChevronRight size={16} />
              </button>
            ) : (
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Registration'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
