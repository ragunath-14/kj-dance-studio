// src/components/About.jsx
import React from 'react'
import { motion } from 'framer-motion'
import './About.css'
import { coreValues, facilitiesData } from '../constants.jsx'

const About = () => {
  return (
    <section id="about" className="about-wrapper">
      <div className="container">
        {/* Mission Section */}
        <div className="mission-grid highlight-section">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="about-content"
          >
            <h2 className="about-title">Our Mission</h2>
            <p className="about-text">
              Our mission is to provide exceptional dance education that inspires creativity, builds confidence, and develops technical proficiency in a supportive and inclusive environment.
            </p>
            <p className="about-text">
              We are committed to offering diverse dance styles, experienced instruction, and performance opportunities that allow every student to discover their unique artistic voice and thrive as dancers.
            </p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="about-image"
          >
            <img 
              src="https://images.unsplash.com/photo-1547153760-18fc86324498?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60" 
              alt="Our Mission" 
            />
          </motion.div>
        </div>

        {/* Vision Section */}
        <div className="vision-grid highlight-section">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="about-image"
          >
            <img 
              src="https://images.unsplash.com/photo-1535525153412-5a42439a210d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60" 
              alt="Our Vision" 
            />
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="about-content"
          >
            <h2 className="about-title">Our Vision</h2>
            <p className="about-text">
              At Expressionz Dance Academy, we envision a world where dance is a universal language that connects people, transcends boundaries, and empowers individuals to express their authentic selves.
            </p>
            <p className="about-text">
              We strive to be a catalyst for artistic innovation, nurturing the next generation of dancers who will shape the future of performing arts with creativity, technical excellence, and passion.
            </p>
          </motion.div>
        </div>

        {/* Core Values Section */}
        <div className="core-values-section">
          <h2 className="section-title">Our <span>Core Values</span></h2>
          <div className="values-grid">
            {coreValues.map((v, i) => (
              <motion.div 
                key={i} 
                className="value-card"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="value-emoji">{v.emoji}</div>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Facilities Section */}
        <div className="facilities-section">
          <h2 className="section-title">Studio <span>Facilities</span></h2>
          <div className="facilities-list-grid">
            {facilitiesData.map((f, i) => (
              <div key={i} className="facility-item">
                <span className="p-dot"></span> {f}
              </div>
            ))}
          </div>
        </div>
        </div>
    </section>
  )
}

export default About
