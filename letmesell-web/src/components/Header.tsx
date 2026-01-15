import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';

export const Header: React.FC = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="header-logo">
          <span className="logo-icon">⏸️</span>
          <span className="logo-text">Pause Menu</span>
        </Link>

        <nav className={`header-nav ${isMenuOpen ? 'open' : ''}`}>
          <Link 
            to="/" 
            className={`nav-link ${isActive('/') ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            Home
          </Link>
          <Link 
            to="/pricing" 
            className={`nav-link ${isActive('/pricing') ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            Pricing
          </Link>
          <Link 
            to="/about" 
            className={`nav-link ${isActive('/about') ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            About
          </Link>
          <Link 
            to="/contact" 
            className={`nav-link ${isActive('/contact') ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            Contact
          </Link>
          <Link 
            to="/download" 
            className="nav-link nav-cta"
            onClick={() => setIsMenuOpen(false)}
          >
            Download
          </Link>
        </nav>

        <button 
          className="header-menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
};

