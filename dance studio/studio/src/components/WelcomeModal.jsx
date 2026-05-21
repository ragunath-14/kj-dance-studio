// src/components/WelcomeModal.jsx
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Phone, Instagram } from '../icons.jsx'
import './WelcomeModal.css'

const WelcomeModal = ({ showModal, setShowModal, onRegister }) => {
  React.useEffect(() => {
    if (showModal) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [showModal])

  return (
    <AnimatePresence>
      {showModal && (
        <motion.div 
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ zIndex: 10000 }}
        >
          <motion.div 
            className="camp-flyer-modal"
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
          >
            <button className="modal-close-btn" onClick={() => setShowModal(false)}>
              <X size={24} />
            </button>

            {/* Header section from image */}
            <header className="flyer-header">
              <div className="header-content">
                <h1>ELEVATE YOUR</h1>
                <div className="sub-title">DANCE SKILLS</div>
              </div>
              
              <div className="eds-logo-box-gold">
                <div className="eds-logo">EDS</div>
                <div className="logo-tagline">DANCE FIRST THINK LATER</div>
              </div>
            </header>

            <div className="flyer-main-title">
              <h2>2026 SUMMER DANCE CAMP</h2>
              <div className="flyer-styles-pill">
                <span>• Freestyle</span>
                <span>• Bollywood</span>
                <span>• Jazz</span>
                <span>• Hip Hop</span>
              </div>
            </div>

            <div className="flyer-body">
              <div className="flyer-grid">
                {/* Left Column - Morning */}
                <div className="grid-col">
                  <div className="parchment-card">
                    <h3>Ladies Dance</h3>
                    <p>6.00 AM - 7.00 AM</p>
                    <p>11.00 AM - 12.00 PM</p>
                  </div>

                  <div className="parchment-card">
                    <h3>Aerobics & Zumba</h3>
                    <p>7.15 AM - 8.15 AM</p>
                    <p>9.00 AM - 11.00 AM</p>
                  </div>
                </div>

                {/* Center Image */}
                <div className="center-box">
                  <div className="diamond-frame">
                    <div className="diamond-inner">
                      <img 
                        src="https://images.unsplash.com/photo-1547153760-18fc86324498?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80" 
                        alt="Dancers" 
                      />
                    </div>
                  </div>
                  <div className="batch-info-overlay">
                    BATCH TIMINGS (MON - FRI)
                  </div>
                </div>

                {/* Right Column - Evening */}
                <div className="grid-col">
                  <div className="parchment-card">
                    <h3>Kids Dance</h3>
                    <p>5.00 PM - 7.00 PM</p>
                  </div>

                  <div className="parchment-card">
                    <h3>Ladies Dance</h3>
                    <p>7.00 PM - 8.00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flyer-footer">
              <div className="footer-btns">
                <button className="btn-register-flyer" onClick={() => { setShowModal(false); onRegister(); }}>
                  REGISTER NOW
                </button>
              </div>

              <div className="footer-address-bar">
                1057, P.K.S.A. Arumugam Road, Near Janaki Raman Hotel, Sivakasi
              </div>

              <a 
                href="https://www.instagram.com/expressionz_dance_studio?igsh=MjdqY2k0dHB6a2M0&utm_source=qr" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="insta-handle"
              >
                <Instagram size={20} /> @EXPRESSIONZ_DANCE_STUDIO
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default WelcomeModal
