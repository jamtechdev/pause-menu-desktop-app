import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './Download.css';

export const Download: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    // Check if email is in URL params (from success page)
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
      checkSubscriptionStatus(emailParam);
    } else {
      // Try to get email from localStorage (if user was logged in)
      const storedEmail = localStorage.getItem('userEmail');
      if (storedEmail) {
        setEmail(storedEmail);
        checkSubscriptionStatus(storedEmail);
      }
    }
  }, [searchParams]);

  const checkSubscriptionStatus = async (userEmail: string) => {
    if (!userEmail) return;
    
    setCheckingSubscription(true);
    try {
      // Check subscription status by email
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/user/subscription-status?email=${encodeURIComponent(userEmail)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const status = data.subscriptionStatus || data.subscription?.plan || 'free';
        setHasSubscription(status !== 'free');
      } else {
        // If check fails, assume they can download (desktop app will verify)
        setHasSubscription(true);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      // On error, allow download (desktop app will verify subscription)
      setHasSubscription(true);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleDownload = () => {
    // Direct download link - desktop app will verify subscription on login
    // In production, replace with actual download URL
    const downloadUrl = 'https://github.com/your-repo/releases/latest/download/PauseMenu-Setup.exe';
    
    // For now, open download URL or show message
    if (downloadUrl && downloadUrl !== 'https://github.com/your-repo/releases/latest/download/PauseMenu-Setup.exe') {
      window.open(downloadUrl, '_blank');
    } else {
      // Temporary: show message with download instructions
      alert('Download link will be available soon. The desktop app will verify your subscription when you log in.');
    }
  };

  return (
    <div className="download-page">
      <div className="download-container">
        <div className="download-content">
          <h1 className="animate-fade-in-up">Download Pause Menu</h1>
          <p className="download-subtitle animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Get the Windows desktop app and boost your productivity
          </p>

          <div className="download-card">
            <div className="download-icon">💻</div>
            <h2>Windows App</h2>
            <p>Download the latest version of Pause Menu for Windows</p>
            
            {checkingSubscription ? (
              <button className="download-button" disabled style={{ opacity: 0.6 }}>
                Checking subscription...
              </button>
            ) : hasSubscription === false && email ? (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <p style={{ color: '#fca5a5', marginBottom: '16px', fontSize: '14px' }}>
                  You're on the Free plan. Upgrade to Pro to unlock all features.
                </p>
                <Link to="/pricing" className="cta-link" style={{ display: 'inline-block' }}>
                  Upgrade to Pro
                </Link>
              </div>
            ) : (
              <button className="download-button" onClick={handleDownload}>
                Download for Windows
              </button>
            )}

            <div className="download-info">
              <p><strong>System Requirements:</strong></p>
              <ul>
                <li>Windows 10 or later</li>
                <li>64-bit processor</li>
                <li>100 MB free disk space</li>
              </ul>
            </div>
          </div>

          <div className="download-cta">
            <p>Don't have an account yet?</p>
            <Link to="/pricing" className="cta-link">
              View Pricing & Subscribe
            </Link>
          </div>

          <div className="download-steps">
            <h3>Getting Started</h3>
            <ol>
              <li>Subscribe to a plan (Free or Pro)</li>
              <li>Download the Windows app</li>
              <li>Install and launch the app</li>
              <li>Log in with your email</li>
              <li>Start using Pause Menu!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

