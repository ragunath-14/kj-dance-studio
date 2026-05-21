// src/components/FloatingActions.jsx
import React from 'react'
import './FloatingActions.css'
import { Instagram, Phone, Mail, MessageCircle } from '../icons.jsx'

const FloatingActions = () => {
  const icons = [
    { icon: <Instagram color="#f97316" />, color: '#ffedd5', link: 'https://www.instagram.com/expressionz_dance_studio?igsh=MjdqY2k0dHB6a2M0&utm_source=qr' },
    { icon: <Phone color="#f97316" />, color: '#ffedd5', link: 'tel:+919626810194' }
  ]

  return (
    <div className="floating-icons">
      {icons.map((item, idx) => (
        <a 
          key={idx} 
          href={item.link} 
          target="_blank" 
          rel="noopener noreferrer"
          className="floating-icon" 
          style={{ backgroundColor: item.color }}
        >
          {item.icon}
        </a>
      ))}
    </div>
  )
}

export default FloatingActions
