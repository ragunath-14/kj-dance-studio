// src/components/Services.jsx
import { motion } from 'framer-motion'
import './Services.css'
import { servicesData } from '../constants.jsx'

const Services = ({ onRegister }) => {
  return (
    <section id="services" className="services" style={{ backgroundColor: 'var(--bg-alt)' }}>
      <div className="container">
        <div className="section-header-centered">
          <h2 className="section-title">Our <span>Services</span></h2>
          <p className="section-subtitle-centered">Experience the joy of dance with our professional training programs.</p>
        </div>
        
        <div className="services-grid premium-services">
          {servicesData.map((s, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="premium-service-card"
            >
              <div className="card-top">
                <div className="p-icon-circle">
                  <span className="p-emoji">{s.emoji}</span>
                </div>
              </div>
              <div className="card-body">
                <h3>{s.title}</h3>
                <p className="card-desc-text">{s.description}</p>
                <ul className="p-feature-list">
                  {s.features.map((f, i) => (
                    <li key={i}><span className="p-dot"></span> {f}</li>
                  ))}
                </ul>
              </div>
              <div className="card-footer-box">
                <button className="btn-explore-service" onClick={onRegister}>
                  Explore Services <span className="arrow">→</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Services
