import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, User, Clock, Mail, Send, ChevronRight, ChevronLeft } from '../icons.jsx'
import API_URL from '../config'
import './RegisterModal.css'


const RegisterModal = ({ showModal, setShowModal }) => {
  const [isShaking, setIsShaking] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    studentName: '',
    studentAge: '',
    gender: '',
    whatsappNumber: '',
    parentName: '',
    phone: '',
    location: '',
    notes: '',
    classType: '',
    danceStyle: '',
    danceForFitness: '',
    whatsappSame: true
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [fieldErrors, setFieldErrors] = useState({})

  React.useEffect(() => {
    if (showModal) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [showModal])

  if (!showModal) return null;

  const validateStep1 = () => {
    const errors = {};
    if (!formData.studentName.trim()) {
      errors.studentName = "Oops! We need the student's name.";
    } else if (formData.studentName.trim().length < 2) {
      errors.studentName = "Name is a bit too short, please use at least 2 characters.";
    }
    if (!formData.phone.trim()) {
      errors.phone = "A phone number is required so we can reach you.";
    } else if (!/^[\d\s+\-()]{10,}$/.test(formData.phone.trim())) {
      errors.phone = "This number doesn't look quite right. Please check again.";
    }
    if (!formData.whatsappSame && !formData.whatsappNumber.trim()) {
      errors.whatsappNumber = "Please provide your WhatsApp number.";
    }
    if (Object.keys(errors).length > 0) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const validateStep2 = () => {
    const errors = {};
    if (!formData.classType) {
      errors.classType = "Please select which class you'd like to join.";
    }
    if (Object.keys(errors).length > 0) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  }

  const handleBack = () => {
    setFieldErrors({});
    setStep(1);
  }

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
        whatsappNumber: formData.whatsappSame ? formData.phone : formData.whatsappNumber
      };
      delete dataToSubmit.whatsappSame;
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit)
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setStatus({ type: 'success', message: 'Congratulations! Registration successful. A confirmation message has been sent to your WhatsApp!' });
        setFormData({
          studentName: '', studentAge: '', classType: '', danceStyle: '',
          danceForFitness: '', whatsappSame: true, whatsappNumber: '',
          parentName: '', phone: '', location: '', notes: '', gender: ''
        });
        setFieldErrors({});
        setStep(1);
        setTimeout(() => { setShowModal(false); setStatus({ type: '', message: '' }); }, 3000);
      } else {
        const errorMsg = data.message || 'We couldn\'t submit your registration. Please try again.';
        if (data.field) {
          setFieldErrors(prev => ({ ...prev, [data.field]: errorMsg }));
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
        }
        setStatus({ type: 'error', message: errorMsg });
      }
    } catch (error) {
      console.error('Registration network error:', error);
      setStatus({ type: 'error', message: "We're having trouble connecting to the server." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 30 : -30, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -30 : 30, opacity: 0 }),
  }

  return (
    <AnimatePresence>
      <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="registration-card-container" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
          <button className="modal-close-reg" onClick={() => { setShowModal(false); setStep(1); setFieldErrors({}); }}><X size={24} /></button>
          <div className="registration-header-outside">
            <h2>Join Our Dance Class</h2>
            <p>Start your dance journey with Expressionz Dance Academy.</p>

            {/* Step Progress Indicator */}
            <div className="step-progress">
              <div className={`step-bubble ${step >= 1 ? 'active' : ''}`}>
                <span>1</span>
              </div>
              <div className={`step-line ${step === 2 ? 'filled' : ''}`}></div>
              <div className={`step-bubble ${step === 2 ? 'active' : ''}`}>
                <span>2</span>
              </div>
            </div>
            <div className="step-labels">
              <span className={step === 1 ? 'label-active' : ''}>Student Details</span>
              <span className={step === 2 ? 'label-active' : ''}>Class Details</span>
            </div>
          </div>

          <div className="registration-main-box">
            <div className="reg-sidebar">
              <h3>Why Join Expressionz?</h3>
              <div className="reg-benefit">
                <div className="reg-icon-box"><User size={20} /></div>
                <div className="reg-benefit-text"><h4>Expert Instructors</h4><p>Learn from certified dance professionals</p></div>
              </div>
              <div className="reg-benefit">
                <div className="reg-icon-box"><div className="reg-icon-circle-custom"><span className="tiny-icon">🌟</span></div></div>
                <div className="reg-benefit-text"><h4>All Skill Levels</h4><p>Classes for beginners to advanced dancers</p></div>
              </div>
              <div className="reg-benefit">
                <div className="reg-icon-box"><Clock size={20} /></div>
                <div className="reg-benefit-text"><h4>Flexible Timings</h4><p>Multiple class schedules available</p></div>
              </div>
              <div className="reg-contact-card">
                <h5>Contact Information</h5>
                <div className="reg-contact-item"><Mail size={14} className="reg-email-icon" /><span>expressionz_dance_studio@gmail.com</span></div>
                <div className="reg-contact-item"><Send size={14} className="reg-send-icon" /><span>We'll respond within 24 hours</span></div>
              </div>
            </div>

            <div className="reg-form-content">
              {status.message && (
                <motion.div className={`form-status-msg ${status.type}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                  {status.type === 'error' && <span className="status-icon">⚠️</span>}
                  {status.type === 'success' && <span className="status-icon">✅</span>}
                  {status.message}
                </motion.div>
              )}

              <div className="slides-wrapper">
                <AnimatePresence mode="wait" custom={step}>
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      custom={1}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.28, ease: 'easeInOut' }}
                      className={`dance-reg-form ${isShaking ? 'shake' : ''}`}
                    >
                      <p className="step-title">👤 Student Details</p>
                      <p className="mandatory-note">* Name and Phone Number are required</p>

                      <div className="form-row">
                        <div className={`form-group ${fieldErrors.studentName ? 'has-error' : ''}`}>
                          <label>Student's Name <span>*</span></label>
                          <input name="studentName" type="text" value={formData.studentName} onChange={handleChange} placeholder="Enter student's name" />
                          {fieldErrors.studentName && <span className="field-error">{fieldErrors.studentName}</span>}
                        </div>
                        <div className="form-row-nested">
                          <div className="form-group">
                            <label>Age</label>
                            <input name="studentAge" type="text" value={formData.studentAge} onChange={handleChange} placeholder="Age" />
                          </div>
                          <div className="form-group">
                            <label>Gender</label>
                            <select name="gender" value={formData.gender} onChange={handleChange}>
                              <option value="">Select</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="form-group full-width">
                        <label>Parent/Guardian Name</label>
                        <input name="parentName" type="text" value={formData.parentName} onChange={handleChange} placeholder="Enter parent/guardian name" />
                      </div>

                      <div className={`form-group full-width ${fieldErrors.phone ? 'has-error' : ''}`}>
                        <label>Phone Number <span>*</span></label>
                        <input name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+91 12345 67890" />
                        {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
                      </div>

                      <div className="whatsapp-toggle-row">
                        <label className="whatsapp-checkbox-label">
                          <input type="checkbox" name="whatsappSame" checked={formData.whatsappSame} onChange={handleChange} />
                          <span>WhatsApp number same as Phone number?</span>
                        </label>
                      </div>
                      {!formData.whatsappSame && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className={`form-group full-width ${fieldErrors.whatsappNumber ? 'has-error' : ''}`}>
                          <label>WhatsApp Number <span>*</span></label>
                          <input name="whatsappNumber" type="tel" value={formData.whatsappNumber} onChange={handleChange} placeholder="+91 WhatsApp number" />
                          {fieldErrors.whatsappNumber && <span className="field-error">{fieldErrors.whatsappNumber}</span>}
                        </motion.div>
                      )}

                      <div className="form-group full-width">
                        <label>Location (Area)</label>
                        <input name="location" type="text" value={formData.location} onChange={handleChange} placeholder="Enter your area" />
                      </div>

                      <button type="button" className="btn-next" onClick={handleNext}>
                        Next: Class Details <ChevronRight size={18} />
                      </button>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.form
                      key="step2"
                      custom={2}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.28, ease: 'easeInOut' }}
                      className={`dance-reg-form ${isShaking ? 'shake' : ''}`}
                      onSubmit={handleSubmit}
                      noValidate
                    >
                      <p className="step-title">🎓 Class Details</p>
                      <p className="mandatory-note">* Class type is required</p>

                      <div className={`form-group full-width ${fieldErrors.classType ? 'has-error' : ''}`}>
                        <label>Select Class <span>*</span></label>
                        <div className="class-type-cards">
                          <div
                            className={`class-card ${formData.classType === 'Dance Class' ? 'selected' : ''}`}
                            onClick={() => { setFormData(p => ({ ...p, classType: 'Dance Class', danceForFitness: '' })); setFieldErrors(p => ({ ...p, classType: '' })); }}
                          >
                            <span className="class-card-icon">💃</span>
                            <span className="class-card-label">Dance Class</span>
                          </div>
                          <div
                            className={`class-card ${formData.classType === 'Fitness Class' ? 'selected' : ''}`}
                            onClick={() => { setFormData(p => ({ ...p, classType: 'Fitness Class', danceStyle: '' })); setFieldErrors(p => ({ ...p, classType: '' })); }}
                          >
                            <span className="class-card-icon">🏋️</span>
                            <span className="class-card-label">Fitness Class</span>
                          </div>
                        </div>
                        {fieldErrors.classType && <span className="field-error">{fieldErrors.classType}</span>}
                      </div>

                      {formData.classType === 'Dance Class' && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="form-group full-width">
                          <label>Dance Style</label>
                          <select name="danceStyle" value={formData.danceStyle} onChange={handleChange}>
                            <option value="" disabled>Select dance style</option>
                            <option value="Hip Hop">Hip Hop</option>
                            <option value="Bollywood">Bollywood</option>
                            <option value="Contemporary">Contemporary</option>
                            <option value="Salsa">Salsa</option>
                            <option value="Folk">Folk</option>
                            <option value="Rock n Roll">Rock n Roll</option>
                            <option value="Freestyle">Freestyle</option>
                            <option value="Ballet">Ballet</option>
                          </select>
                        </motion.div>
                      )}

                      {formData.classType === 'Fitness Class' && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="form-group full-width">
                          <label>Fitness Style</label>
                          <select name="danceForFitness" value={formData.danceForFitness} onChange={handleChange}>
                            <option value="" disabled>Select fitness style</option>
                            <option value="Fitness">Fitness</option>
                            <option value="Aerobics">Aerobics</option>
                            <option value="Zumba">Zumba</option>
                            <option value="Reebok fitness">Reebok fitness</option>
                          </select>
                        </motion.div>
                      )}

                      <div className="form-group full-width">
                        <label>Additional Notes</label>
                        <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Any special requirements or notes..."></textarea>
                      </div>

                      <div className="form-actions-row">
                        <button type="button" className="btn-back" onClick={handleBack}>
                          <ChevronLeft size={18} /> Back
                        </button>
                        <button type="submit" className="btn-join-class" disabled={isSubmitting}>
                          {isSubmitting ? <><span className="spinner"></span> Submitting...</> : <><Send size={18} /> Join Class</>}
                        </button>
                      </div>
                      <p className="form-footer-note">Your information will be sent securely</p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default RegisterModal
