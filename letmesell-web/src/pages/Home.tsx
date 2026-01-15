import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

export const Home: React.FC = () => {
  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-container">
          <h1 className="home-title animate-fade-in-up">
            Pause Menu
          </h1>
          <p className="home-subtitle animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Your productivity command center. Fast, beautiful, and powerful.
          </p>
          <div className="home-cta animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <Link to="/pricing" className="cta-button primary hover-lift">
              View Pricing
            </Link>
            <Link to="/download" className="cta-button secondary hover-lift">
              Download App
            </Link>
          </div>
        </div>
      </div>

      <div className="home-features">
        <div className="home-container">
          <h2 className="features-title">Why Pause Menu?</h2>
          <div className="features-grid">
            <div className="feature-card animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="feature-icon">⚡</div>
              <h3>Lightning Fast</h3>
              <p>Instant access to everything you need with keyboard shortcuts</p>
            </div>
            <div className="feature-card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="feature-icon">🎨</div>
              <h3>Beautiful Design</h3>
              <p>Modern, clean interface that doesn't get in your way</p>
            </div>
            <div className="feature-card animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="feature-icon">🔒</div>
              <h3>Secure</h3>
              <p>Your data stays on your device. Privacy first.</p>
            </div>
            <div className="feature-card animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="feature-icon">🚀</div>
              <h3>Powerful</h3>
              <p>Advanced features for power users and teams</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

