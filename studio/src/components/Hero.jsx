// src/components/Hero.jsx
import React from 'react'
import { motion } from 'framer-motion'
import './Hero.css'
import { ArrowRight } from '../icons.jsx'

const Hero = ({ onRegister }) => {
  const danceStyles = ['Hip Hop', 'Bollywood', 'Jazz', 'Freestyle', 'Aerobics', 'Zumba']

  return (
    <section className="hero">
      <div className="hero-overlay"></div>

      {/* Floating decorative orbs */}
      <div className="hero-orb hero-orb-1"></div>
      <div className="hero-orb hero-orb-2"></div>

      <div className="container hero-container">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
          className="hero-content"
        >
          <motion.span 
            className="hero-subtitle"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Experience the Art of Movement
          </motion.span>

          <h1 className="hero-title">We make your <span>dreams</span> come true through dance.</h1>
          <p className="hero-description">Professional training in all dance forms.</p>

          {/* Mobile Dance Style Badges */}
          <div className="hero-style-badges">
            {danceStyles.map((style, i) => (
              <motion.span 
                key={style}
                className="style-badge"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
              >
                {style}
              </motion.span>
            ))}
          </div>

          <div className="hero-btns">
            <button className="btn btn-primary" onClick={onRegister}>Join Classes <ArrowRight size={18} /></button>
            <a href="#about" className="btn btn-outline" style={{ color: 'white', borderColor: 'white' }}>Learn More</a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Hero
