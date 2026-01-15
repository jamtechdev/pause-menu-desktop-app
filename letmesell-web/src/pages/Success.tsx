import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import './Success.css';

export const Success: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="success-page">
      <div className="success-container">
        <div className="success-content">
          <div className="success-icon">✅</div>
          <h1 className="animate-fade-in-up">Thank You!</h1>
          <p className="success-message animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Your subscription is now active. You can start using all Pro features!
          </p>

          {sessionId && (
            <div className="success-info">
              <p>Session ID: <code>{sessionId}</code></p>
            </div>
          )}

          <div className="success-actions">
            <Link to="/download" className="success-button primary">
              Download Windows App
            </Link>
            <Link to="/" className="success-button secondary">
              Back to Home
            </Link>
          </div>

          <div className="success-next-steps">
            <h3>Next Steps:</h3>
            <ol>
              <li>Download the Windows app from the link above</li>
              <li>Install and launch the app</li>
              <li>Log in with the email you used to subscribe</li>
              <li>Your Pro features will be automatically unlocked!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

