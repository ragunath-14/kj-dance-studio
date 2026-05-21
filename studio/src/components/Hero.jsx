// src/components/Hero.jsx
import React from 'react'
import { motion } from 'framer-motion'
import './Hero.css'
import { ArrowRight } from '../icons.jsx'

const Hero = ({ onRegister }) => {
  return (
    <section className="hero">
      <div className="hero-overlay"></div>
      <div className="container hero-container">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
          className="hero-content"
        >
          <span className="hero-subtitle">Experience the Art of Movement</span>
          <h1 className="hero-title">We make your <span>dreams</span> come true through dance.</h1>
          <p className="hero-description">Professional training in all dance forms.</p>
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
