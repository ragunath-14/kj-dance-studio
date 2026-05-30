import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Users, Heart, Building2, Music, Gift, Zap, GraduationCap, Home, Laptop, MapPin, Trophy, Video, Clock, BookOpen, Star, Phone, Menu, X } from 'lucide-react';

const InstagramIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
  </svg>
);

const YoutubeIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58a2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="black"/>
  </svg>
);
import './App.css';
import Register from './components/Register';
import AdminRoot from './admin/AdminRoot';
import logo from './assets/logo.png';
import heroBg from './assets/hero-bg.png';
import salsaImg from './assets/salsa.png';
import hiphopImg from './assets/hiphop.png';
import contemporaryImg from './assets/contemporary.png';
import bollywoodImg from './assets/bollywood.png';

const ServicesSection = () => {
  const services = [
    { icon: Users, title: 'Regular Classes', desc: 'Daily dance classes for all skill levels' },
    { icon: Heart, title: 'Wedding Events', desc: 'Choreography for your special day' },
    { icon: Building2, title: 'Corporate Events', desc: 'Team building through dance' },
    { icon: Music, title: 'Sangeet Events', desc: 'Traditional celebration choreography' },
    { icon: Gift, title: 'Puberty Functions', desc: 'Special celebration dances' },
    { icon: Zap, title: 'Flash Mobs', desc: 'Flash performance visualization' },
    { icon: GraduationCap, title: 'School Choreographies', desc: 'Educational institution performances' },
    { icon: Home, title: 'Home Tuitions', desc: 'Personalized training at home' },
    { icon: Laptop, title: 'Online Classes', desc: 'Virtual dance training sessions' },
    { icon: MapPin, title: 'Apartment Classes', desc: 'Community-based dance lessons' },
    { icon: Trophy, title: 'Competition Jury', desc: 'Professional judging services' },
    { icon: Video, title: 'Video Productions', desc: 'Professional dance videos' }
  ];

  return (
    <section id="services" className="section-padding services-section">
      <div className="container">
        <div className="text-center">
          <h2 className="section-title">Our <span className="highlight">Services</span></h2>
        </div>
        <div className="services-grid">
          {services.map((service, index) => (
            <div key={index} className="service-card">
              <div className="service-icon">
                <service.icon size={32} />
              </div>
              <h3>{service.title}</h3>
              <p>{service.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const LandingPage = ({ setIsRegisterOpen }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAdminClick = () => {
    navigate("/admin");
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="container nav-container">
          <div className="logo">
            <img src={logo} alt="KJ Studio Logo" className="logo-img" />
          </div>
          
          <button className="mobile-menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <ul className={`nav-links ${isMenuOpen ? 'mobile-open' : ''}`}>
            <li><a href="#home" onClick={() => setIsMenuOpen(false)}>Home</a></li>
            <li><a href="#about" onClick={() => setIsMenuOpen(false)}>About</a></li>
            <li><a href="#classes" onClick={() => setIsMenuOpen(false)}>Classes</a></li>
            <li><a href="#services" onClick={() => setIsMenuOpen(false)}>Services</a></li>
            <li><a href="#contact" onClick={() => setIsMenuOpen(false)}>Contact</a></li>
            <li className="mobile-only-btn">
              <button onClick={() => { setIsRegisterOpen(true); setIsMenuOpen(false); }} className="btn-nav">Join Now</button>
            </li>
          </ul>
          
          <div className="nav-btns desktop-only">
            <button onClick={() => setIsRegisterOpen(true)} className="btn-nav">Join Now</button>
            <button onClick={handleAdminClick} className="btn-admin-nav">Admin</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header id="home" className="hero" style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(${heroBg})` }}>
        <div className="hero-content">
          <h3>Welcome to KJ Dance and Fitness Studio</h3>
          <h2>SHALL WE <span className="highlight">DANCE?</span></h2>
          <p>Experience the passion, energy, and elegance of dance with the best instructors in the city.</p>
          <div className="hero-btns">
            <a href="#classes" className="btn-primary">View Classes</a>
            <button onClick={() => setIsRegisterOpen(true)} className="btn-outline">Join Now</button>
          </div>
        </div>
      </header>

      {/* About Section */}
      <section id="about" className="section-padding about-section">
        <div className="container grid-2">
          <div className="about-text">
            <h2 className="section-title">Elevate Your Movement</h2>
            <p>At KJ Dance Studio, we believe that dance is more than just movement—it's a way of life. Whether you're a beginner looking to find your rhythm or a professional aiming to refine your technique, our studio offers a diverse range of styles tailored to every level.</p>
            <p>Founded with a passion for artistic expression, we provide a supportive and vibrant environment where students can grow, perform, and connect.</p>
            <a href="#classes" className="btn-primary">Learn More</a>
          </div>
          <div className="about-image">
             <div className="image-card">
                <img src={contemporaryImg} alt="About KJ Studio" />
             </div>
          </div>
        </div>
      </section>

      {/* Classes Section */}
      <section id="classes" className="section-padding classes-section">
        <div className="container">
          <div className="text-center">
            <h2 className="section-title">Our Dance Styles</h2>
          </div>
          <div className="classes-grid">
            <div className="class-card">
              <img src={salsaImg} alt="Salsa & Ballroom" />
              <div className="class-overlay">
                <h3>Salsa & Ballroom</h3>
                <p>Feel the rhythm and connection.</p>
                <a href="#" className="read-more">Learn More →</a>
              </div>
            </div>
            <div className="class-card">
              <img src={hiphopImg} alt="Hip Hop" />
              <div className="class-overlay">
                <h3>Hip Hop</h3>
                <p>Express yourself through urban movement.</p>
                <a href="#" className="read-more">Learn More →</a>
              </div>
            </div>
            <div className="class-card">
              <img src={bollywoodImg} alt="Bollywood" />
              <div className="class-overlay">
                <h3>Bollywood</h3>
                <p>High energy, vibrant colors, and pure joy.</p>
                <a href="#" className="read-more">Learn More →</a>
              </div>
            </div>
            <div className="class-card">
              <img src={contemporaryImg} alt="Contemporary" />
              <div className="class-overlay">
                <h3>Contemporary</h3>
                <p>Elegance and emotional expression.</p>
                <a href="#" className="read-more">Learn More →</a>
              </div>
            </div>
          </div>
        </div>
      </section>



      <ServicesSection />
      
      {/* Benefits Section */}
      <section className="section-padding benefits-section">
        <div className="container">
          <div className="text-center">
            <h2 className="section-title">Benefits & <span className="highlight">Perks</span></h2>
          </div>
          <div className="benefits-grid">

            <div className="benefit-card">
              <div className="benefit-icon schedule"><Clock size={32} /></div>
              <h3>Flexible Schedule</h3>
              <p>Balance your work and personal life with our flexible scheduling options.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon development"><BookOpen size={32} /></div>
              <h3>Professional Development</h3>
              <p>Continuous learning opportunities with workshops and training sessions.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon performance"><Star size={32} /></div>
              <h3>Performance Opportunities</h3>
              <p>Showcase your talent in our regular studio performances and events.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Footer Section */}
      <footer id="contact" className="footer">
        <div className="container footer-grid">
          <div className="footer-info">
            <img src={logo} alt="KJ Studio Logo" className="footer-logo" />
            <p>Where Passion Meets Movement. Join us and discover the dancer within you.</p>
            <div className="social-icons">
              <a href="https://www.instagram.com/kj_dancestudio?igsh=MWhxbGRyNXlhM2Y2Yw==" target="_blank" rel="noopener noreferrer"><InstagramIcon size={18} /></a>
              <a href="https://youtube.com/@kuttyjapan7549?si=j4zibdmBWXJfZ_F5" target="_blank" rel="noopener noreferrer"><YoutubeIcon size={18} /></a>
              <a href="tel:+919344148031"><Phone size={18} /></a>
            </div>
          </div>
          <div className="footer-links">
            <h3>Quick Links</h3>
            <ul>
              <li><a href="#home">Home</a></li>
              <li><a href="#about">About Us</a></li>
              <li><a href="#classes">Classes</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
          <div className="footer-contact">
            <h3>Our Location</h3>
            <p><strong>KJ Dance and Fitness Studio</strong></p>
            <p>89, Town Police Station Road,</p>
            <p>Near Appans Hotel,</p>
            <p>Sivakasi - 626 123.</p>
            <p style={{ marginTop: '15px' }}><strong>Contact:</strong> +91 93441 48031</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 KJ Dance and Fitness Studio. All Rights Reserved.</p>
        </div>
      </footer>
      
      {/* Floating Contact Group */}
      <div className="contact-fab-group">
        <a 
          href="https://youtube.com/@kuttyjapan7549?si=j4zibdmBWXJfZ_F5" 
          className="fab-item youtube" 
          target="_blank" 
          rel="noopener noreferrer"
          title="Watch us on YouTube"
        >
          <YoutubeIcon size={24} />
        </a>
        <a 
          href="https://www.instagram.com/kj_dancestudio?igsh=MWhxbGRyNXlhM2Y2Yw==" 
          className="fab-item instagram" 
          target="_blank" 
          rel="noopener noreferrer"
          title="Follow us on Instagram"
        >
          <InstagramIcon size={24} />
        </a>
        <a 
          href="tel:+919344148031" 
          className="fab-item phone" 
          title="Call us now"
        >
          <Phone size={24} />
        </a>
      </div>
    </div>
  );
};

function App() {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  return (
    <div className="app-root">
      <Routes>
        <Route path="/" element={<LandingPage setIsRegisterOpen={setIsRegisterOpen} />} />
        <Route path="/admin/*" element={<AdminRoot />} />
        
        {/* Redirect legacy paths for smoother transition */}
        <Route path="/students" element={<Navigate to="/admin/students" replace />} />
        <Route path="/payments" element={<Navigate to="/admin/payments" replace />} />
        <Route path="/registrations" element={<Navigate to="/admin/registrations" replace />} />
        <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
      </Routes>
      <Register isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} />
    </div>
  );
}

export default App;
