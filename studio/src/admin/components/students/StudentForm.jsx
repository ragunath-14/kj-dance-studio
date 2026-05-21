import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../config';
import { useData } from '../../context/DataContext';
import { ChevronRight, ChevronLeft, Send, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react';

const DANCE_STYLES = ['Hip Hop', 'Bollywood', 'Contemporary', 'Salsa', 'Folk', 'Rock n Roll', 'Freestyle', 'Ballet', 'K-Pop'];
const FITNESS_STYLES = ['Fitness', 'Aerobics', 'Zumba', 'Reebok fitness'];

const StudentForm = ({ formData, setFormData, onCancel, isEditing, editingStudentId }) => {
  const { refreshData } = useData();
  const [step, setStep] = useState(1);
  const [stepErrors, setStepErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const [whatsappSame, setWhatsappSame] = useState(
    isEditing ? (!formData.whatsappNumber || formData.whatsappNumber === formData.phone) : true
  );

  const update = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (stepErrors[field]) setStepErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep1 = () => {
    const errors = {};
    if (!formData.studentName?.trim()) {
      errors.studentName = "Oops! We need the student's name.";
    } else if (formData.studentName.trim().length < 2) {
      errors.studentName = "Name is a bit too short, please use at least 2 characters.";
    }

    if (!formData.phone?.trim()) {
      errors.phone = "A phone number is required so we can reach the student.";
    } else if (!/^[\d\s+\-()]{10,}$/.test(formData.phone.trim())) {
      errors.phone = "This number doesn't look quite right. Please check again.";
    }

    if (!whatsappSame && !formData.whatsappNumber?.trim()) {
      errors.whatsappNumber = "Please provide a WhatsApp number.";
    }

    if (Object.keys(errors).length > 0) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors = {};
    if (!formData.classType) {
      errors.classType = "Please select a class type.";
    }
    if (Object.keys(errors).length > 0) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleBack = () => {
    setStepErrors({});
    setStep(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!validateStep2()) {
      setStatus({ type: 'error', message: 'Something is missing. Please check the highlighted fields below.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const dataToSubmit = {
        ...formData,
        whatsappNumber: whatsappSame ? formData.phone : formData.whatsappNumber
      };

      if (isEditing) {
        await axios.put(`${API_URL}/students/${editingStudentId}`, dataToSubmit);
      } else {
        await axios.post(`${API_URL}/students`, dataToSubmit);
      }

      setStatus({
        type: 'success',
        message: isEditing 
          ? '🎉 Student details updated successfully!' 
          : '🎉 Congratulations! Registration successful. A confirmation message has been sent to their WhatsApp!'
      });

      // Refresh parent lists
      await refreshData();

      // Close modal after 3 seconds so they can see the success message
      setTimeout(() => {
        onCancel();
      }, 3000);
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.message || 'We ran into an issue saving the student details. Please try again.';
      setStatus({ type: 'error', message: errorMsg });
      
      // If error contains specific fields, mark them
      if (err.response?.data?.field) {
        setStepErrors(prev => ({ ...prev, [err.response.data.field]: errorMsg }));
      }
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (label, name, type = 'text', placeholder = '', required = false) => (
    <div className={`sf-group ${stepErrors[name] ? 'has-error' : ''}`}>
      <label className="sf-label">
        {label} {required && <span>*</span>}
      </label>
      <input
        type={type}
        value={formData[name] || ''}
        onChange={e => update(name, e.target.value)}
        placeholder={placeholder}
        disabled={isSubmitting}
      />
      {stepErrors[name] && (
        <span className="field-error">{stepErrors[name]}</span>
      )}
    </div>
  );

  const selectField = (label, name, options, placeholder = 'Select') => (
    <div className="sf-group">
      <label className="sf-label">{label}</label>
      <select
        value={formData[name] || ''}
        onChange={e => update(name, e.target.value)}
        disabled={isSubmitting}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value || o} value={o.value || o}>{o.label || o}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className={`modern-student-form ${isShaking ? 'shake' : ''}`}>
      {/* Premium Success Overlay */}
      {status.message && status.type === 'success' && (
        <div className="form-success-overlay animate-fade-in">
          <div className="success-card">
            <div className="success-icon-wrapper">
              <Sparkles className="success-sparkle-1" size={24} />
              <CheckCircle className="success-main-icon" size={64} />
              <Sparkles className="success-sparkle-2" size={20} />
            </div>
            <h3>Good Job!</h3>
            <p className="success-message">{status.message}</p>
            <div className="countdown-bar">
              <div className="countdown-fill"></div>
            </div>
            <span className="closing-hint">Closing window...</span>
          </div>
        </div>
      )}

      {/* Inline Status Error Message Banner */}
      {status.message && status.type === 'error' && (
        <div className="form-status-msg error animate-fade-in">
          <AlertTriangle size={18} className="status-icon" />
          <span>{status.message}</span>
        </div>
      )}

      {/* Step Indicators */}
      <div className="step-progress-row">
        <div className={`step-bubble ${step >= 1 ? 'active' : ''}`}>
          <span>1</span>
        </div>
        <div className={`step-line ${step === 2 ? 'filled' : ''}`}></div>
        <div className={`step-bubble ${step === 2 ? 'active' : ''}`}>
          <span>2</span>
        </div>
      </div>
      <div className="step-labels-row">
        <span className={step === 1 ? 'label-active' : ''}>Student Details</span>
        <span className={step === 2 ? 'label-active' : ''}>Class Details</span>
      </div>

      {/* Step 1: Student Details */}
      {step === 1 && (
        <div className="form-step-content animate-fade-in">
          <p className="step-title-text">👤 Student & Parent Info</p>
          <p className="mandatory-note-text">* Student Name and Phone are required</p>

          <div className="form-grid-2">
            {field('Student Name', 'studentName', 'text', "Enter student's full name", true)}
            <div className="form-grid-nested-2">
              {field('Age', 'studentAge', 'text', 'Age')}
              {selectField('Gender', 'gender', [
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Other', label: 'Other' }
              ], 'Select')}
            </div>
          </div>

          <div className="form-grid-2">
            {field('Phone Number', 'phone', 'tel', '+91 XXXXX XXXXX', true)}
            <div className="whatsapp-checkbox-container">
              <label className="whatsapp-checkbox-label">
                <input
                  type="checkbox"
                  checked={whatsappSame}
                  onChange={e => {
                    setWhatsappSame(e.target.checked);
                    if (e.target.checked) {
                      update('whatsappNumber', '');
                    }
                  }}
                  disabled={isSubmitting}
                />
                <span>WhatsApp same as Phone?</span>
              </label>
            </div>
          </div>

          {/* Conditional WhatsApp Input */}
          {!whatsappSame && (
            <div className="whatsapp-field-wrapper animate-fade-in">
              {field('WhatsApp Number', 'whatsappNumber', 'tel', '+91 XXXXX XXXXX', true)}
            </div>
          )}

          <div className="form-grid-2">
            {field('Parent / Guardian Name', 'parentName', 'text', 'Guardian name')}
            {field('Location (Area)', 'location', 'text', 'e.g. T. Nagar')}
          </div>

          <div className="form-grid-2">
            {field('Join Date', 'createdAt', 'date', '', true)}
            {field('Batch Timing', 'batchTiming', 'text', 'e.g. 5:00 PM')}
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary-custom" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="button" className="btn-primary-custom" onClick={handleNext} disabled={isSubmitting}>
              Next: Class Details <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Class Details */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="form-step-content animate-fade-in">
          <p className="step-title-text">🎓 Class & Style Selection</p>
          <p className="mandatory-note-text">* Class type selection is required</p>

          <div className="class-cards-group">
            <label className="sf-label-bold">Select Class Type <span>*</span></label>
            <div className="class-cards-grid">
              {[
                { value: 'Dance Class', icon: '💃', label: 'Dance Class' },
                { value: 'Fitness Class', icon: '🏋️', label: 'Fitness Class' },
                { value: 'Regular Class', icon: '🎓', label: 'Regular Class' },
              ].map(cls => (
                <div
                  key={cls.value}
                  onClick={() => {
                    if (isSubmitting) return;
                    update('classType', cls.value);
                    if (cls.value === 'Dance Class') update('danceForFitness', '');
                    if (cls.value === 'Fitness Class') update('danceStyle', '');
                  }}
                  className={`class-selection-card ${formData.classType === cls.value ? 'selected' : ''}`}
                >
                  <span className="card-emoji">{cls.icon}</span>
                  <span className="card-text-label">{cls.label}</span>
                </div>
              ))}
            </div>
            {stepErrors.classType && (
              <span className="field-error">{stepErrors.classType}</span>
            )}
          </div>

          {/* Conditional Styles Fields */}
          {formData.classType === 'Dance Class' && (
            <div className="conditional-dropdown-wrapper animate-fade-in">
              {selectField('Dance Style', 'danceStyle', DANCE_STYLES, 'Select dance style')}
            </div>
          )}

          {formData.classType === 'Fitness Class' && (
            <div className="conditional-dropdown-wrapper animate-fade-in">
              {selectField('Fitness Style', 'danceForFitness', FITNESS_STYLES, 'Select fitness style')}
            </div>
          )}

          {/* Legacy type warning */}
          {isEditing && !['Dance Class', 'Fitness Class', 'Regular Class'].includes(formData.classType) && (
            <div className="legacy-warning-alert">
              <AlertTriangle size={16} />
              <span>Legacy class type: <strong>{formData.classType}</strong>. You may update it above.</span>
            </div>
          )}

          <div className="sf-group">
            <label className="sf-label">Additional Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={e => update('notes', e.target.value)}
              placeholder="Any special remarks or requirements..."
              disabled={isSubmitting}
            />
          </div>

          <div className="form-actions-between">
            <button type="button" className="btn-secondary-custom" onClick={handleBack} disabled={isSubmitting}>
              <ChevronLeft size={16} /> Back
            </button>
            <button type="submit" className="btn-join-custom" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner-icon"></span>
                  Saving...
                </>
              ) : (
                <>
                  <Send size={16} />
                  {isEditing ? 'Update Student' : 'Add Student'}
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Styled css overrides specifically for beautiful visuals in standard Modal */}
      <style>{`
        /* Global Modal Structure Overrides for High-End Glassmorphism */
        .modal {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.97) 0%, rgba(15, 23, 42, 0.99) 100%) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 0, 0, 0.3) !important;
          border-radius: 24px !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          overflow: hidden !important;
        }
        
        .modal-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          padding: 24px 32px !important;
          background: rgba(15, 23, 42, 0.2) !important;
        }

        .modal-header h2 {
          color: #ffffff !important;
          font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
          font-weight: 850 !important;
          font-size: 1.45rem !important;
          letter-spacing: -0.025em !important;
          background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          margin: 0 !important;
        }

        .btn-close {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 12px !important;
          width: 38px !important;
          height: 38px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #94a3b8 !important; /* slate-400 */
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          cursor: pointer !important;
        }

        .btn-close:hover {
          background: rgba(239, 68, 68, 0.1) !important;
          color: #f87171 !important;
          border-color: rgba(239, 68, 68, 0.2) !important;
          transform: rotate(90deg) !important;
        }

        .modal-content {
          padding: 28px 36px !important;
          background: transparent !important;
        }

        .modern-student-form {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 18px;
          color: #f8fafc !important;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        /* Premium Step progress indicator */
        .step-progress-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          margin-top: 4px;
          margin-bottom: 4px;
        }

        .step-bubble {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.1) !important;
          background: rgba(15, 23, 42, 0.6) !important;
          color: #64748b !important; /* slate-500 */
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.95rem;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }

        .step-bubble.active {
          border-color: #ff8c00 !important;
          background: linear-gradient(135deg, #ff8c00 0%, #f97316 100%) !important;
          color: #0f172a !important; /* Dark slate text */
          box-shadow: 0 0 16px rgba(251, 146, 60, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
          transform: scale(1.05);
        }

        .step-line {
          width: 80px;
          height: 3px;
          background: rgba(255, 255, 255, 0.08) !important;
          border-radius: 999px;
          position: relative;
          overflow: hidden;
        }

        .step-line.filled::after {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, #ff8c00, #f97316) !important;
          animation: fillLine 0.4s ease forwards;
        }

        @keyframes fillLine {
          from { transform: scaleX(0); transform-origin: left; }
          to { transform: scaleX(1); transform-origin: left; }
        }

        .step-labels-row {
          display: flex;
          justify-content: center;
          gap: 60px;
          font-size: 0.8rem;
          color: #64748b !important;
          margin-bottom: 24px;
          font-weight: 600;
        }

        .step-labels-row span {
          transition: all 0.3s ease;
        }

        .step-labels-row .label-active {
          color: #ff8c00 !important;
          font-weight: 800;
          text-shadow: 0 0 8px rgba(251, 146, 60, 0.2);
        }

        .step-title-text {
          font-size: 1.15rem !important;
          font-weight: 800 !important;
          color: #ffffff !important;
          margin: 0 0 6px 0 !important;
          letter-spacing: -0.015em !important;
        }

        .mandatory-note-text {
          font-size: 0.78rem !important;
          color: #94a3b8 !important;
          margin: 0 0 20px 0 !important;
          opacity: 0.85;
        }

        .form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
          align-items: end;
        }

        .form-grid-nested-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .sf-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sf-label {
          font-size: 0.8rem !important;
          font-weight: 700 !important;
          color: #94a3b8 !important; /* slate-400 */
          margin-bottom: 2px !important;
          letter-spacing: 0.03em !important;
          text-transform: uppercase !important;
        }

        .sf-label-bold {
          font-size: 0.85rem !important;
          font-weight: 800 !important;
          color: #ffffff !important;
          margin-bottom: 12px !important;
          letter-spacing: 0.02em !important;
          text-transform: uppercase !important;
        }

        .sf-label span, .sf-label-bold span {
          color: #f87171 !important;
        }

        /* Custom gorgeous glowing input controls overriding light-mode defaults */
        .modern-student-form .sf-group input, 
        .modern-student-form .sf-group select, 
        .modern-student-form .sf-group textarea,
        .sf-group input, 
        .sf-group select, 
        .sf-group textarea {
          background: rgba(30, 41, 59, 0.45) !important;
          background-color: rgba(30, 41, 59, 0.45) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #f8fafc !important; /* bright white-grey text */
          padding: 12px 16px !important;
          border-radius: 12px !important;
          font-size: 0.9rem !important;
          outline: none !important;
          width: 100% !important;
          box-sizing: border-box !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2) !important;
          font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
        }

        .modern-student-form .sf-group input::placeholder,
        .modern-student-form .sf-group textarea::placeholder,
        .sf-group input::placeholder,
        .sf-group textarea::placeholder {
          color: #64748b !important; /* slate-500 placeholder */
        }

        .modern-student-form .sf-group input:hover, 
        .modern-student-form .sf-group select:hover, 
        .modern-student-form .sf-group textarea:hover,
        .sf-group input:hover, 
        .sf-group select:hover, 
        .sf-group textarea:hover {
          border-color: rgba(255, 255, 255, 0.15) !important;
          background: rgba(30, 41, 59, 0.6) !important;
          background-color: rgba(30, 41, 59, 0.6) !important;
        }

        .modern-student-form .sf-group input:focus, 
        .modern-student-form .sf-group select:focus, 
        .modern-student-form .sf-group textarea:focus,
        .sf-group input:focus, 
        .sf-group select:focus, 
        .sf-group textarea:focus {
          border-color: #ff8c00 !important;
          background: rgba(30, 41, 59, 0.8) !important;
          background-color: rgba(30, 41, 59, 0.8) !important;
          box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2), inset 0 2px 4px rgba(0, 0, 0, 0.1) !important;
        }

        /* Premium Calendar Picker Invert Icon for dark mode background consistency */
        .modern-student-form input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1) hue-rotate(180deg) brightness(1.2);
          cursor: pointer;
        }

        /* Native select dropdown styles override */
        .modern-student-form .sf-group select option,
        .sf-group select option {
          background-color: #0f172a !important; /* slate-900 */
          color: #f8fafc !important;
          padding: 12px !important;
        }

        .sf-group textarea {
          min-height: 85px;
          resize: vertical;
        }

        .whatsapp-checkbox-container {
          display: flex;
          align-items: center;
          height: 48px;
          padding-left: 4px;
        }

        .whatsapp-checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.88rem;
          font-weight: 600;
          color: #cbd5e1 !important; /* slate-300 */
          cursor: pointer;
          user-select: none;
          transition: color 0.2s ease;
        }

        .whatsapp-checkbox-label:hover {
          color: #ffffff !important;
        }

        /* Custom premium checkbox override */
        .modern-student-form .whatsapp-checkbox-label input[type="checkbox"],
        .whatsapp-checkbox-label input[type="checkbox"] {
          width: 20px !important;
          height: 20px !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          background: rgba(30, 41, 59, 0.6) !important;
          background-color: rgba(30, 41, 59, 0.6) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 6px !important;
          outline: none !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2) !important;
        }

        .modern-student-form .whatsapp-checkbox-label input[type="checkbox"]:checked,
        .whatsapp-checkbox-label input[type="checkbox"]:checked {
          background: linear-gradient(135deg, #ff8c00 0%, #f97316 100%) !important;
          border-color: #ff8c00 !important;
          box-shadow: 0 0 10px rgba(251, 146, 60, 0.3) !important;
        }

        .modern-student-form .whatsapp-checkbox-label input[type="checkbox"]::before,
        .whatsapp-checkbox-label input[type="checkbox"]::before {
          content: "✓" !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          color: #0f172a !important;
          display: none !important;
        }

        .modern-student-form .whatsapp-checkbox-label input[type="checkbox"]:checked::before,
        .whatsapp-checkbox-label input[type="checkbox"]:checked::before {
          display: block !important;
        }

        .whatsapp-field-wrapper {
          margin-bottom: 16px;
        }

        /* Premium Class Selection Cards */
        .class-cards-group {
          display: flex;
          flex-direction: column;
          margin-bottom: 16px;
        }

        .class-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 14px;
        }

        .class-selection-card {
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          background: rgba(30, 41, 59, 0.3) !important;
          border-radius: 16px !important;
          padding: 16px 12px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 10px !important;
          cursor: pointer !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
        }

        .class-selection-card:hover {
          border-color: rgba(251, 146, 60, 0.4) !important;
          background: rgba(30, 41, 59, 0.6) !important;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3) !important;
        }

        .class-selection-card.selected {
          border-color: #ff8c00 !important;
          background: rgba(251, 146, 60, 0.12) !important;
          box-shadow: 0 0 16px rgba(251, 146, 60, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.1) !important;
          transform: scale(1.02);
        }

        .card-emoji {
          font-size: 2rem !important;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.25));
          transition: transform 0.3s ease;
        }

        .class-selection-card:hover .card-emoji {
          transform: scale(1.15) rotate(5deg);
        }

        .card-text-label {
          font-size: 0.85rem !important;
          font-weight: 800 !important;
          text-align: center !important;
          color: #cbd5e1 !important; /* slate-300 */
          letter-spacing: 0.01em !important;
        }

        .class-selection-card.selected .card-text-label {
          color: #ff8c00 !important;
        }

        /* Action Buttons */
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        .form-actions-between {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-primary-custom {
          background: linear-gradient(135deg, #ff8c00 0%, #f97316 100%) !important;
          color: #0f172a !important; /* dark text */
          padding: 12px 24px !important;
          border: none !important;
          border-radius: 12px !important;
          font-weight: 800 !important;
          font-size: 0.95rem !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          cursor: pointer !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: 0 4px 12px rgba(251, 146, 60, 0.25) !important;
        }

        .btn-primary-custom:hover {
          background: linear-gradient(135deg, #fbbf24 0%, #ff8c00 100%) !important;
          box-shadow: 0 6px 20px rgba(251, 146, 60, 0.4) !important;
          transform: translateY(-1.5px);
        }

        .btn-secondary-custom {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #cbd5e1 !important; /* slate-300 */
          padding: 12px 24px !important;
          border-radius: 12px !important;
          font-weight: 700 !important;
          font-size: 0.95rem !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          cursor: pointer !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .btn-secondary-custom:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
          color: #ffffff !important;
          transform: translateY(-1px);
        }

        .btn-join-custom {
          background: linear-gradient(135deg, #ff8c00 0%, #f97316 100%) !important;
          color: #0f172a !important; /* dark text */
          padding: 12px 28px !important;
          border: none !important;
          border-radius: 12px !important;
          font-weight: 800 !important;
          font-size: 0.95rem !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          cursor: pointer !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: 0 4px 12px rgba(251, 146, 60, 0.25) !important;
        }

        .btn-join-custom:hover {
          background: linear-gradient(135deg, #fbbf24 0%, #ff8c00 100%) !important;
          box-shadow: 0 6px 20px rgba(251, 146, 60, 0.4) !important;
          transform: translateY(-1.5px);
        }

        .btn-join-custom:disabled, .btn-primary-custom:disabled, .btn-secondary-custom:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
          transform: none !important;
          box-shadow: none !important;
        }

        /* Error States & Validation */
        .sf-group.has-error input,
        .sf-group.has-error select,
        .sf-group.has-error textarea {
          border-color: #ef4444 !important;
          background: rgba(239, 68, 68, 0.06) !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15) !important;
        }

        .sf-group.has-error .sf-label {
          color: #f87171 !important;
        }

        .field-error {
          color: #f87171 !important;
          font-size: 0.8rem !important;
          font-weight: 600 !important;
          margin-top: 6px !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
        }

        .field-error::before {
          content: '⚠️';
          font-size: 0.75rem;
        }

        /* Inline Status Messages */
        .form-status-msg {
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          line-height: 1.4;
          margin-bottom: 8px;
        }

        .form-status-msg.success {
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.2);
        }

        .form-status-msg.error {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          border: 1px solid rgba(248, 113, 113, 0.2);
        }

        .status-icon {
          flex-shrink: 0;
        }

        .legacy-warning-alert {
          background: rgba(234, 179, 8, 0.1);
          color: #fef08a;
          border: 1px solid rgba(234, 179, 8, 0.2);
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        /* Animations */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }

        .shake {
          animation: shake 0.4s ease both;
        }

        /* Spinner */
        .spinner-icon {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(0,0,0,0.25);
          border-top-color: black;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 500px) {
          .form-grid-2 {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .class-cards-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Premium success overlay style overrides */
        .form-success-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.82); /* Sleek dark slate glass backdrop */
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          border-radius: 12px;
          padding: 20px;
        }

        .success-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
          border: 1px solid rgba(74, 222, 128, 0.25); /* Subtle emerald border glow */
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 32px 24px;
          width: 100%;
          max-width: 360px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          animation: cardPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .success-icon-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 96px;
          height: 96px;
          background: radial-gradient(circle, rgba(74, 222, 128, 0.15) 0%, rgba(74, 222, 128, 0) 70%);
        }

        .success-main-icon {
          color: #4ade80; /* Emerald check */
          filter: drop-shadow(0 0 12px rgba(74, 222, 128, 0.5));
          animation: iconGrow 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .success-sparkle-1 {
          position: absolute;
          top: 10px;
          right: 10px;
          color: #fb923c; /* Sunset orange sparkle */
          filter: drop-shadow(0 0 6px rgba(251, 146, 60, 0.6));
          animation: sparkleFloat 2s ease-in-out infinite alternate;
        }

        .success-sparkle-2 {
          position: absolute;
          bottom: 12px;
          left: 8px;
          color: #38bdf8; /* Sky blue sparkle for extra depth */
          filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.6));
          animation: sparkleFloat 2.3s ease-in-out infinite alternate-reverse;
        }

        .success-card h3 {
          color: #ffffff;
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.025em;
          background: linear-gradient(to right, #ffffff, #e2e8f0);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .success-message {
          color: #cbd5e1;
          font-size: 0.9rem;
          line-height: 1.5;
          margin: 0;
        }

        .countdown-bar {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          overflow: hidden;
          margin-top: 8px;
        }

        .countdown-fill {
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, #4ade80, #22c55e);
          border-radius: 999px;
          transform-origin: left;
          animation: shrinkWidth 3.0s linear forwards;
        }

        .closing-hint {
          font-size: 0.72rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        @keyframes cardPopIn {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes iconGrow {
          0% {
            opacity: 0;
            transform: scale(0.5) rotate(-15deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0);
          }
        }

        @keyframes sparkleFloat {
          0% {
            transform: translateY(0) scale(0.8) rotate(0deg);
            opacity: 0.7;
          }
          100% {
            transform: translateY(-6px) scale(1.1) rotate(15deg);
            opacity: 1;
          }
        }

        @keyframes shrinkWidth {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default StudentForm;
