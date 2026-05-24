import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import RegisterModal from './components/RegisterModal.jsx'
import FloatingActions from './components/FloatingActions.jsx'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import About from './components/About.jsx'
import Services from './components/Services.jsx'
import WhyChoose from './components/WhyChoose.jsx'
import Schedule from './components/Schedule.jsx'
import Footer from './components/Footer.jsx'
import AdminModule from './admin/AdminModule.jsx'
import './App.css'

const MainPortal = () => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="app">
      <RegisterModal showModal={showRegisterModal} setShowModal={setShowRegisterModal} />
      <FloatingActions />
      <Header 
        isScrolled={isScrolled} 
        isMenuOpen={isMenuOpen} 
        setIsMenuOpen={setIsMenuOpen} 
        onRegister={() => setShowRegisterModal(true)}
      />
      <main>
        <Hero onRegister={() => setShowRegisterModal(true)} />
        <About />
        <Services onRegister={() => setShowRegisterModal(true)} />
        <WhyChoose />
        <Schedule />
      </main>
      <Footer />
    </div>
  )
}

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainPortal />} />
        <Route path="/admin/*" element={<AdminModule />} />
      </Routes>
    </Router>
  )
}

export default App
