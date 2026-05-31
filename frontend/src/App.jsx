import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Users, Heart, Building2, Music, Gift, Zap, GraduationCap, Home, Laptop, MapPin, Trophy, Video, Clock, BookOpen, Star, Phone, Menu, X, Sun, Moon, Calendar, Dumbbell, Baby, UserCheck, Wind, Droplets, Wifi, Camera, Car, Volume2, Shirt, BatteryCharging, ShieldCheck, Sofa, CheckCircle2 } from 'lucide-react';

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

/* ─── Schedule Section ───────────────────────────────────────────── */
const ScheduleSection = ({ onRegister }) => {
  const batches = [
    {
      id: 'fitness',
      icon: Dumbbell,
      label: 'Fitness Dance Class',
      accent: '#ED1C24',
      accentBg: 'rgba(237,28,36,0.08)',
      fee: '₹2000 / month',
      feeNote: 'Adults',
      batches: [
        {
          name: 'Morning Batch',
          icon: Sun,
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          time: '6:00 AM – 7:00 AM',
          tag: 'All Week',
          tagColor: '#ED1C24',
        },
      ],
    },
    {
      id: 'kids',
      icon: Baby,
      label: 'Kids Dance Class',
      accent: '#3B82F6',
      accentBg: 'rgba(59,130,246,0.08)',
      fee: '₹1000 / month',
      feeNote: 'Kids',
      batches: [
        {
          name: 'Weekday Batch',
          icon: Calendar,
          days: ['Mon', 'Wed', 'Fri'],
          time: '6:00 PM – 7:00 PM',
          tag: 'Weekdays',
          tagColor: '#3B82F6',
        },
        {
          name: 'Weekend Batch',
          icon: Moon,
          days: ['Sat', 'Sun'],
          time: '4:30 PM – 6:00 PM',
          tag: 'Weekend',
          tagColor: '#8B5CF6',
        },
      ],
    },
    {
      id: 'adults',
      icon: UserCheck,
      label: 'Adults Dance Class',
      accent: '#F59E0B',
      accentBg: 'rgba(245,158,11,0.08)',
      fee: '₹2000 / month',
      feeNote: 'Adults',
      batches: [
        {
          name: 'Weekend Batch',
          icon: Moon,
          days: ['Sat', 'Sun'],
          time: '6:00 PM – 7:30 PM',
          tag: 'Weekend',
          tagColor: '#F59E0B',
        },
      ],
    },
  ];

  return (
    <section id="schedule" className="section-padding schedule-section">
      <div className="container">
        <div className="text-center">
          <h2 className="section-title">Class <span className="highlight">Schedule</span></h2>
          <p className="section-sub">Pick the batch that fits your day. All classes are at our studio in Sivakasi.</p>
        </div>

        <div className="schedule-grid">
          {batches.map((cat) => (
            <div key={cat.id} className="schedule-card" style={{ '--card-accent': cat.accent, '--card-accent-bg': cat.accentBg }}>
              {/* Card header */}
              <div className="sc-header">
                <div className="sc-icon" style={{ background: cat.accentBg, color: cat.accent }}>
                  <cat.icon size={26} />
                </div>
                <div>
                  <h3 className="sc-title">{cat.label}</h3>
                  <p className="sc-fee" style={{ color: cat.accent }}>{cat.fee} <span>· {cat.feeNote}</span></p>
                </div>
              </div>

              {/* Batch rows */}
              <div className="sc-batches">
                {cat.batches.map((batch, bi) => (
                  <div key={bi} className="sc-batch">
                    <div className="sc-batch-top">
                      <span className="sc-batch-name">
                        <batch.icon size={13} style={{ color: batch.tagColor }} />
                        {batch.name}
                      </span>
                      <span className="sc-tag" style={{ background: `${batch.tagColor}20`, color: batch.tagColor }}>{batch.tag}</span>
                    </div>

                    <div className="sc-days">
                      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                        <span
                          key={d}
                          className={`sc-day ${batch.days.includes(d) ? 'active' : ''}`}
                          style={batch.days.includes(d) ? { background: batch.tagColor } : {}}
                        >{d}</span>
                      ))}
                    </div>

                    <div className="sc-time">
                      <Clock size={14} />
                      <strong>{batch.time}</strong>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                className="sc-cta"
                style={{ background: cat.accent, boxShadow: `0 6px 20px ${cat.accent}40` }}
                onClick={onRegister}
              >
                Join This Class
              </button>
            </div>
          ))}
        </div>

        {/* Weekly overview strip */}
        <div className="weekly-strip">
          <h4><Calendar size={16} /> Weekly Overview</h4>
          <div className="weekly-table">
            {[
              { day: 'Monday',    slots: ['Fitness 6–7 AM', 'Kids 6–7 PM'] },
              { day: 'Tuesday',   slots: ['Fitness 6–7 AM'] },
              { day: 'Wednesday', slots: ['Fitness 6–7 AM', 'Kids 6–7 PM'] },
              { day: 'Thursday',  slots: ['Fitness 6–7 AM'] },
              { day: 'Friday',    slots: ['Fitness 6–7 AM', 'Kids 6–7 PM'] },
              { day: 'Saturday',  slots: ['Fitness 6–7 AM', 'Kids 4:30–6 PM', 'Adults 6–7:30 PM'] },
              { day: 'Sunday',    slots: ['Kids 4:30–6 PM', 'Adults 6–7:30 PM'] },
            ].map(({ day, slots }) => (
              <div key={day} className="weekly-row">
                <span className="weekly-day">{day}</span>
                <div className="weekly-slots">
                  {slots.map((s, i) => (
                    <span key={i} className={`weekly-slot ${
                      s.startsWith('Fitness') ? 'slot-fitness' :
                      s.startsWith('Kids')    ? 'slot-kids'    : 'slot-adults'
                    }`}>{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ─── Facilities Section ─────────────────────────────────────── */
const FacilitiesSection = () => {
  const facilities = [
    {
      icon: Wind,
      name: 'Fully Air Conditioned',
      desc: 'Studio maintained at the perfect temperature all year round for comfortable dancing.',
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.1)',
    },
    {
      icon: Volume2,
      name: 'Premium Sound System',
      desc: 'High-fidelity speakers and professional audio setup for an immersive experience.',
      color: '#ED1C24',
      bg: 'rgba(237,28,36,0.1)',
    },
    {
      icon: Camera,
      name: 'CCTV Surveillance 24/7',
      desc: 'Round-the-clock security cameras ensure a safe environment for all students.',
      color: '#8B5CF6',
      bg: 'rgba(139,92,246,0.1)',
    },
    {
      icon: Wifi,
      name: 'High-Speed WiFi',
      desc: 'Complimentary high-speed internet for students and instructors throughout the studio.',
      color: '#10B981',
      bg: 'rgba(16,185,129,0.1)',
    },
    {
      icon: Shirt,
      name: 'Dressing Rooms',
      desc: 'Private, spacious dressing rooms with mirrors and secure lockers for your belongings.',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.1)',
    },
    {
      icon: Droplets,
      name: 'RO Purified Water',
      desc: 'Fresh RO-filtered drinking water available at all times to keep you hydrated.',
      color: '#06B6D4',
      bg: 'rgba(6,182,212,0.1)',
    },
    {
      icon: BatteryCharging,
      name: 'UPS Power Backup',
      desc: 'Uninterrupted power supply ensures classes go on without interruption during outages.',
      color: '#F97316',
      bg: 'rgba(249,115,22,0.1)',
    },
    {
      icon: Car,
      name: 'Ample Parking',
      desc: 'Safe and spacious parking area available for two-wheelers and four-wheelers.',
      color: '#64748B',
      bg: 'rgba(100,116,139,0.1)',
    },
    {
      icon: Sofa,
      name: 'Comfortable Waiting Area',
      desc: 'A relaxing lounge for parents and guests while students enjoy their classes.',
      color: '#EC4899',
      bg: 'rgba(236,72,153,0.1)',
    },
    {
      icon: Home,
      name: 'Clean Rest Rooms',
      desc: 'Hygienic and well-maintained restrooms for students and visitors at all times.',
      color: '#84CC16',
      bg: 'rgba(132,204,22,0.1)',
    },
  ];

  return (
    <section id="facilities" className="section-padding facilities-section">
      <div className="container">

        {/* Section header */}
        <div className="text-center">
          <h2 className="section-title">Studio <span className="highlight">Facilities</span></h2>
          <p className="section-sub">We've built more than a dance studio — a world-class space where comfort meets passion.</p>
        </div>

        {/* Facilities grid */}
        <div className="facilities-grid">
          {facilities.map((f, i) => (
            <div key={i} className="facility-card" style={{ '--fc': f.color, '--fb': f.bg }}>
              <div className="fc-icon-wrap">
                <f.icon size={26} />
              </div>
              <div className="fc-body">
                <h4 className="fc-name">{f.name}</h4>
                <p className="fc-desc">{f.desc}</p>
              </div>
              <CheckCircle2 size={16} className="fc-check" />
            </div>
          ))}
        </div>

        {/* Bottom trust strip */}
        <div className="facilities-trust-strip">
          <div className="fts-item">
            <ShieldCheck size={22} color="#ED1C24" />
            <span>Safe & Secure Environment</span>
          </div>
          <div className="fts-divider" />
          <div className="fts-item">
            <CheckCircle2 size={22} color="#10B981" />
            <span>Hygiene Standards Maintained Daily</span>
          </div>
          <div className="fts-divider" />
          <div className="fts-item">
            <Star size={22} color="#F59E0B" />
            <span>Premium Experience Guaranteed</span>
          </div>
        </div>

      </div>
    </section>
  );
};

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
            <li><a href="#schedule" onClick={() => setIsMenuOpen(false)}>Schedule</a></li>
            <li><a href="#facilities" onClick={() => setIsMenuOpen(false)}>Facilities</a></li>
            <li><a href="#services" onClick={() => setIsMenuOpen(false)}>Services</a></li>
            <li><a href="#contact" onClick={() => setIsMenuOpen(false)}>Contact</a></li>
            <li className="mobile-only-btn">
              <button onClick={() => { setIsRegisterOpen(true); setIsMenuOpen(false); }} className="btn-nav">Join Now</button>
            </li>
            <li className="mobile-only-btn">
              <button onClick={() => { handleAdminClick(); setIsMenuOpen(false); }} className="btn-admin-nav">Admin</button>
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
            <h2 className="section-title">Our Dance <span className="highlight">Styles</span></h2>
            <p className="section-sub">Discover a world of movement — from classical traditions to modern beats</p>
          </div>
          <div className="classes-grid">

            {/* ── Image cards ── */}
            <div className="class-card">
              <img src={salsaImg} alt="Salsa & Ballroom" />
              <div className="class-overlay">
                <span className="class-tag">Partner Dance</span>
                <h3>Salsa & Ballroom</h3>
                <p>Feel the rhythm and connection of partner dance.</p>
                <span className="read-more">Explore →</span>
              </div>
            </div>

            <div className="class-card">
              <img src={hiphopImg} alt="Hip Hop" />
              <div className="class-overlay">
                <span className="class-tag">Street</span>
                <h3>Hip Hop</h3>
                <p>Express yourself through bold urban movement.</p>
                <span className="read-more">Explore →</span>
              </div>
            </div>

            <div className="class-card">
              <img src={bollywoodImg} alt="Bollywood" />
              <div className="class-overlay">
                <span className="class-tag">Filmi</span>
                <h3>Bollywood</h3>
                <p>High energy, vibrant colors, and pure joy.</p>
                <span className="read-more">Explore →</span>
              </div>
            </div>

            <div className="class-card">
              <img src={contemporaryImg} alt="Contemporary" />
              <div className="class-overlay">
                <span className="class-tag">Modern</span>
                <h3>Contemporary</h3>
                <p>Elegance, flow, and emotional expression.</p>
                <span className="read-more">Explore →</span>
              </div>
            </div>

            {/* ── Photo cards for 5 more styles ── */}
            <div className="class-card" style={{ background: 'linear-gradient(145deg,#c2410c,#fbbf24)' }}>
              <img
                src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80"
                alt="Kuthu Dance"
                loading="lazy"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div className="class-overlay">
                <span className="class-tag">Kollywood</span>
                <h3>Kuthu Dance</h3>
                <p>Tamil folk energy with cinematic swagger.</p>
                <span className="read-more">Explore →</span>
              </div>
            </div>

            <div className="class-card" style={{ background: 'linear-gradient(145deg,#065f46,#0ea5e9)' }}>
              <img
                src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80"
                alt="Zumba"
                loading="lazy"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div className="class-overlay">
                <span className="class-tag">Fitness</span>
                <h3>Zumba</h3>
                <p>Dance your way to fitness — high-energy fun.</p>
                <span className="read-more">Explore →</span>
              </div>
            </div>

            <div className="class-card" style={{ background: 'linear-gradient(145deg,#1e1b4b,#7c3aed)' }}>
              <img
                src="https://images.unsplash.com/photo-1508700929628-8e7f2a6d8c8f?auto=format&fit=crop&w=800&q=80"
                alt="Break Dance"
                loading="lazy"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div className="class-overlay">
                <span className="class-tag">Street</span>
                <h3>Break Dance</h3>
                <p>Spins, freezes, and gravity-defying power moves.</p>
                <span className="read-more">Explore →</span>
              </div>
            </div>

            <div className="class-card" style={{ background: 'linear-gradient(145deg,#0c4a6e,#6366f1)' }}>
              <img
                src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80"
                alt="Western Dance"
                loading="lazy"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div className="class-overlay">
                <span className="class-tag">Modern</span>
                <h3>Western Dance</h3>
                <p>Jazz, freestyle and contemporary western forms.</p>
                <span className="read-more">Explore →</span>
              </div>
            </div>

            <div className="class-card" style={{ background: 'linear-gradient(145deg,#7c2d12,#d97706)' }}>
              <img
                src="https://images.unsplash.com/photo-1535525153412-5a42439a210d?auto=format&fit=crop&w=800&q=80"
                alt="Folk Dance"
                loading="lazy"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div className="class-overlay">
                <span className="class-tag">Traditional</span>
                <h3>Folk Dance</h3>
                <p>Celebrate culture through vibrant Tamil folk.</p>
                <span className="read-more">Explore →</span>
              </div>
            </div>

          </div>
        </div>
      </section>



      <ScheduleSection onRegister={() => setIsRegisterOpen(true)} />
      <FacilitiesSection />
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
              <li><a href="#schedule">Schedule</a></li>
              <li><a href="#facilities">Facilities</a></li>
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
