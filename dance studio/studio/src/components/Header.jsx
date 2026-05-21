import { X, Menu } from '../icons'
import './Header.css'
import { navLinks } from '../constants'

const Header = ({ isScrolled, isMenuOpen, setIsMenuOpen, onRegister }) => {
  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container header-container">
        <div className="logo">
          <h1 className="logo-text">Expressionz<span>.</span></h1>
        </div>
        
        <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
          <ul>
            {navLinks.map((link) => (
              <li key={link.name}>
                <a href={link.href} onClick={() => setIsMenuOpen(false)}>{link.name}</a>
              </li>
            ))}
            <li className="mobile-only-action">
              <button className="btn btn-primary btn-full" onClick={() => { onRegister(); setIsMenuOpen(false); }}>Register Now</button>
            </li>
          </ul>
        </nav>

        <div className="header-actions">
          <button className="btn btn-primary btn-sm hide-mobile" onClick={() => window.location.href = '/admin'} style={{background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', marginRight: '10px'}}>Admin</button>
          <button className="btn btn-primary btn-sm hide-mobile" onClick={onRegister}>Register Now</button>
          <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
