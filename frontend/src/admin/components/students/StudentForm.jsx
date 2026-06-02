import React, { useState } from 'react';
import { User, Phone, MessageCircle, Calendar, Users, Music } from 'lucide-react';
import Button from '../ui/Button';

const computeCategory = (age, classType) => {
  if (classType === 'Fitness Class') return 'Adults';
  const n = parseInt(age);
  if (!age || isNaN(n)) return 'Adults';
  return n > 9 ? 'Adults' : 'Kids';
};

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

  const isValid =
    formData.studentName?.trim() &&
    formData.phone?.trim() &&
    formData.classType;

  const handleFormSubmit = (e) => {
    if (!isValid) { e.preventDefault(); return; }
    setFormData(prev => ({ ...prev, studentCategory }));
    onSubmit(e);
  };

  return (
    <form onSubmit={handleFormSubmit} className="admin-student-form">

      <div className="form-group full-width">
        <label><User size={14} /> Student's Full Name *</label>
        <input
          type="text"
          name="studentName"
          value={formData.studentName}
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
            value={formData.phone}
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
          {['Regular Class', 'Fitness Class', 'Online Class'].map(type => (
            <div
              key={type}
              className={`type-option-admin ${formData.classType === type ? 'selected' : ''}`}
              onClick={() => setFormData(prev => ({
                ...prev,
                classType: type,
                danceForFitness: type !== 'Fitness Class' ? '' : prev.danceForFitness
              }))}
            >
              {type}
              {type === 'Fitness Class' && <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '6px' }}>— Adults only</span>}
              {type === 'Online Class' && <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '6px' }}>— Virtual</span>}
            </div>
          ))}
        </div>
      </div>

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
