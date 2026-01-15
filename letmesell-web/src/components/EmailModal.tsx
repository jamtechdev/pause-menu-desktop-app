import React, { useState } from 'react';
import './EmailModal.css';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
  loading?: boolean;
}

export const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
}) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    onSubmit(trimmedEmail);
  };

  if (!isOpen) return null;

  return (
    <div className="email-modal-overlay" onClick={onClose}>
      <div className="email-modal" onClick={(e) => e.stopPropagation()}>
        <button className="email-modal-close" onClick={onClose}>×</button>
        <h2>Enter Your Email</h2>
        <p>We'll use this email to create your account and send you the download link.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="email-modal-input-group">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="your@email.com"
              required
              disabled={loading}
              className="email-modal-input"
            />
            {error && <div className="email-modal-error">{error}</div>}
          </div>

          <div className="email-modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="email-modal-button secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="email-modal-button primary"
              disabled={loading || !email.trim()}
            >
              {loading ? 'Processing...' : 'Continue to Checkout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

