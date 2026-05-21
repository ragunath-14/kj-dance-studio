import { motion } from 'framer-motion'
import { achievementsData } from '../constants'

const Achievements = () => {
  return (
    <section className="achievements">
      <div className="container">
        <div className="achievements-grid">
          {achievementsData.map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              className="achievement-item"
            >
              <h2 className="gradient-text">{item.val}</h2>
              <p>{item.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Achievements
