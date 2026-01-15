import React from 'react';
import './About.css';

export const About: React.FC = () => {
  return (
    <div className="about-page">
      <div className="about-hero">
        <div className="about-container">
          <h1 className="animate-fade-in-up">About Pause Menu</h1>
          <p className="about-subtitle animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            We're building the future of productivity, one keystroke at a time.
          </p>
        </div>
      </div>

      <div className="about-content">
        <div className="about-container">
          <section className="about-section">
            <h2>Our Mission</h2>
            <p>
              Pause Menu was born from a simple idea: productivity tools should be fast, 
              beautiful, and get out of your way. We believe that the best software 
              doesn't slow you down—it amplifies what you can do.
            </p>
            <p>
              Our mission is to create tools that feel like an extension of your mind, 
              allowing you to focus on what matters most without fighting with your software.
            </p>
          </section>

          <section className="about-section">
            <h2>What We Do</h2>
            <div className="features-grid">
              <div className="feature-item">
                <div className="feature-icon">⚡</div>
                <h3>Lightning Fast</h3>
                <p>Built for speed. Every interaction is optimized for instant response.</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🎨</div>
                <h3>Beautiful Design</h3>
                <p>Thoughtfully crafted interface that delights without distracting.</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔒</div>
                <h3>Privacy First</h3>
                <p>Your data stays on your device. We don't track, we don't sell.</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🚀</div>
                <h3>Always Improving</h3>
                <p>Regular updates with new features based on your feedback.</p>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Our Story</h2>
            <p>
              Pause Menu started as a personal project to solve our own productivity challenges. 
              Frustrated with slow, cluttered tools that got in the way, we set out to build 
              something better.
            </p>
            <p>
              What began as a simple command palette has evolved into a comprehensive productivity 
              platform. Today, thousands of users rely on Pause Menu to streamline their workflow 
              and get more done.
            </p>
          </section>

          <section className="about-section">
            <h2>Join Us</h2>
            <p>
              We're always looking for feedback, ideas, and passionate users who want to help 
              shape the future of Pause Menu. Whether you're a power user, developer, or just 
              someone who loves great software, we'd love to hear from you.
            </p>
            <div className="about-cta">
              <a href="/contact" className="cta-button">Get in Touch</a>
              <a href="/download" className="cta-button secondary">Try Pause Menu</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

