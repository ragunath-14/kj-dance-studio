import React from 'react'
import { motion } from 'framer-motion'
import './Schedule.css'

const Schedule = () => {
  const morningBatches = [
    { time: '6:00 AM - 7:00 AM', type: 'Ladies Dance Batch' },
    { time: '7:15 AM - 8:15 AM', type: 'Aerobics & Zumba' },
    { time: '9:00 AM - 10:00 AM', type: 'Aerobics & Zumba' },
    { time: '10:00 AM - 11:00 AM', type: 'Aerobics & Zumba' },
    { time: '11:00 AM - 12:00 PM', type: 'Ladies Dance Batch' },
  ]

  const eveningBatches = [
    { time: '5:00 PM - 6:00 PM', type: 'Kids Dance Batch' },
    { time: '6:00 PM - 7:00 PM', type: 'Kids Dance Batch' },
    { time: '7:00 PM - 8:00 PM', type: 'Ladies Dance Batch' },
  ]

  const weekendBatches = [
    { day: 'Saturday', time: '7:15 PM - 8:30 PM', type: 'Teenage Batch' },
    { day: 'Sunday', time: '11:00 AM - 1:30 PM', type: 'Teenage Batch' },
  ]

  return (
    <section id="schedule" className="schedule-section">
      <div className="container">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="section-header"
        >
          <h2 className="section-title">Batch <span>Timings</span></h2>
          <p className="schedule-subtitle">Classes for Everyone</p>
        </motion.div>

        <div className="schedule-grid">
          {/* Morning Batches */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="schedule-box"
          >
            <div className="box-header">
              <span className="emoji">🌅</span>
              <h3>Morning (M-F)</h3>
            </div>
            <div className="timing-list">
              {morningBatches.map((item, index) => (
                <div key={index} className="timing-item">
                  <span className="time">{item.time}</span>
                  <span className="type">{item.type}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Evening Batches */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="schedule-box"
          >
            <div className="box-header">
              <span className="emoji">🌇</span>
              <h3>Evening (M-F)</h3>
            </div>
            <div className="timing-list">
              {eveningBatches.map((item, index) => (
                <div key={index} className="timing-item">
                  <span className="time">{item.time}</span>
                  <span className="type">{item.type}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Weekend Batches */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="schedule-box weekend"
          >
            <div className="box-header">
              <span className="emoji">✨</span>
              <h3>Weekend Batch</h3>
            </div>
            <p className="target-group">Teenage Selective</p>
            <div className="timing-list">
              {weekendBatches.map((item, index) => (
                <div key={index} className="timing-item weekend-item">
                  <div className="day-info">
                    <span className="day">{item.day}</span>
                    <span className="time">{item.time}</span>
                  </div>
                  <span className="type">{item.type}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default Schedule
