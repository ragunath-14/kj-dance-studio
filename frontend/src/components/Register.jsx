import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { User, Phone, MessageCircle, Calendar, Users, ChevronDown } from 'lucide-react';
import './Register.css';

/* ─── Custom Dropdown ─────────────────────────────────────────────────────── */
const CustomSelect = ({ value, onChange, options, placeholder, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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

/* ─── Category helper ─────────────────────────────────────────────────────── */
const computeCategory = (age, classType) => {
  if (classType === 'Fitness Class') return 'Adults';
  const n = parseInt(age);
  if (!age || isNaN(n)) return 'Adults';
  return n > 9 ? 'Adults' : 'Kids';
};

/* ─── Main Component ─────────────────────────────────────────────────────── */
const Register = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    studentName: '',
    studentAge: '',
    gender: '',
    classType: '',
    danceForFitness: '',
    whatsappNumber: '',
    phone: '',
  });
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

  const handleSelectChange = (name) => (value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSameNumber = () => {
    const next = !isSameNumber;
    setIsSameNumber(next);
    if (next) setFormData(prev => ({ ...prev, whatsappNumber: prev.phone }));
  };

  const studentCategory = computeCategory(formData.studentAge, formData.classType);

  const isValid =
    formData.studentName?.trim() &&
    formData.phone?.trim() &&
    formData.classType;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await axios.post('/api/register', { ...formData, studentCategory });
      if (res.data.success) {
        setMessage({ type: 'success', text: 'Registration submitted! We will contact you soon.' });
        setFormData({
          studentName: '', studentAge: '', gender: '',
          classType: '', danceForFitness: '', whatsappNumber: '', phone: ''
        });
        setIsSameNumber(false);
        setTimeout(onClose, 3000);
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to submit. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const genderOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
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

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-grid">

            <div className="form-group full-width">
              <label><User size={12} /> Full Name *</label>
              <input type="text" name="studentName" value={formData.studentName} onChange={handleChange} placeholder="Student Name" />
            </div>

            <div className="form-group">
              <label><Phone size={12} /> Phone Number *</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="Contact Number" />
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
              <div style={{ position: 'relative' }}>
                <input type="number" name="studentAge" value={formData.studentAge} onChange={handleChange} placeholder="Age" min="1" max="99" />
                {formData.studentAge && formData.classType && (
                  <span className="category-auto-badge">
                    {studentCategory}
                  </span>
                )}
              </div>
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
              <label>Dance Class *</label>
              <div className="class-type-selector">
                {['Regular Class', 'Fitness Class'].map(type => (
                  <div
                    key={type}
                    className={`type-option ${formData.classType === type ? 'selected' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, classType: type }))}
                  >
                    {type}
                    {type === 'Fitness Class' && <span className="class-note"> — Adults only</span>}
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="form-footer">
            <button type="submit" className="btn-primary" disabled={loading || !isValid}>
              {loading ? 'Submitting...' : 'Submit Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
