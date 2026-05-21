// src/components/WhyChoose.jsx
import React from 'react'
import { motion } from 'framer-motion'
import './WhyChoose.css'
import { CheckCircle } from '../icons.jsx'

const WhyChoose = () => {
  const points = [
    "Expert & Celebrity Trainers from the industry.",
    "Prime Location with state-of-the-art facilities.",
    "100% Performance Guarantee on stage.",
    "Flexible batches for working professionals."
  ]

  return (
    <section className="why-choose">
      <div className="container">
        <div className="why-choose-grid">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} className="why-text">
            <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '1rem' }}>Why Choose <span>Expressionz?</span></h2>
            <ul className="why-list">
              {points.map((p, i) => (
                <li key={i}><CheckCircle className="text-purple-500" /> <span>{p}</span></li>
              ))}
            </ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} className="why-image">
            <img src="https://images.unsplash.com/photo-1546519638-68e109498ffc?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60" alt="Why Expressionz" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default WhyChoose
