import React, { useState } from 'react';
import { User, Phone, MessageCircle, Calendar, Users, Music, Activity, ChevronRight, ChevronLeft } from 'lucide-react';
import Button from '../ui/Button';

const StudentForm = ({ formData, setFormData, onSubmit, onCancel, isEditing }) => {
  const [activeStep, setActiveStep] = useState(1);
  const [isSameNumber, setIsSameNumber] = useState(formData.whatsappNumber === formData.phone && formData.phone !== '');

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
    if (newSame) {
      setFormData(prev => ({ ...prev, whatsappNumber: prev.phone }));
    }
  };

  const nextStep = () => setActiveStep(2);
  const prevStep = () => setActiveStep(1);

  return (
    <form onSubmit={onSubmit} className="admin-student-form">
      {/* Step Indicators */}
      <div className="registration-tabs admin-version">
        <div className={`tab-item ${activeStep === 1 ? 'active' : ''} ${activeStep > 1 ? 'completed' : ''}`} onClick={() => setActiveStep(1)}>
          <span className="step-num">1</span>
          <span className="step-label">Student Details</span>
        </div>
        <div className={`tab-item ${activeStep === 2 ? 'active' : ''}`} onClick={() => setActiveStep(2)}>
          <span className="step-num">2</span>
          <span className="step-label">Class Info</span>
        </div>
      </div>

      <div className="form-content-steps">
        {/* Step 1: Student Details */}
        {activeStep === 1 && (
          <div className="form-step animate-slide-in">
            <div className="form-group full-width">
              <label><User size={14} /> Student's Full Name *</label>
              <input 
                type="text" 
                name="studentName"
                value={formData.studentName} 
                onChange={handleChange} 
                required 
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
                  required 
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
                <label><Users size={14} /> Student Category *</label>
                <select name="studentCategory" value={formData.studentCategory || ''} onChange={handleChange} required>
                  <option value="">Select Category</option>
                  <option value="Adults">Adults</option>
                  <option value="Kids">Kids</option>
                </select>
              </div>
              <div className="form-group">
                <label><Calendar size={14} /> Student Age</label>
                <input 
                  type="text" 
                  name="studentAge"
                  value={formData.studentAge || ''} 
                  onChange={handleChange} 
                  placeholder="Age"
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group full-width">
                <label><Users size={14} /> Gender</label>
                <select name="gender" value={formData.gender || ''} onChange={handleChange}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Class Info */}
        {activeStep === 2 && (
          <div className="form-step animate-slide-in">
            <div className="form-group full-width">
              <label><Music size={14} /> Class Type *</label>
              <div className="class-type-selector-admin">
                {['Regular Class', 'Fitness Class'].map(type => (
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
                  value={formData.createdAt ? new Date(formData.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} 
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <div className="footer-left">
          {activeStep === 2 && (
            <Button variant="secondary" onClick={prevStep} type="button" icon={ChevronLeft}>Back</Button>
          )}
          <Button variant="ghost" onClick={onCancel} type="button">Cancel</Button>
        </div>
        <div className="footer-right">
          {activeStep === 1 ? (
            <Button variant="primary" onClick={nextStep} type="button" icon={ChevronRight}>Continue</Button>
          ) : (
            <Button type="submit" variant="primary">{isEditing ? 'Update Student' : 'Save Student'}</Button>
          )}
        </div>
      </div>
    </form>
  );
};

export default StudentForm;
