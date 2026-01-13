import React, { useState } from 'react';
import { api } from '../../services/api';
import './../../styles/screens.css';

interface OAuthCallbackProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const OAuthCallback: React.FC<OAuthCallbackProps> = ({ onSuccess, onCancel }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter the authorization code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.handleOAuthCallback('google', code.trim());
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to complete authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-primary, #1a1a1a)',
        padding: '2rem',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '90%',
        border: '1px solid var(--border, #333)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Complete Google Calendar Authentication</h3>
        <div style={{ marginBottom: '1.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            After authorizing in your browser, you'll be redirected to a URL that looks like:
          </p>
          <code style={{
            display: 'block',
            padding: '0.5rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '4px',
            fontSize: '0.75rem',
            wordBreak: 'break-all',
            marginBottom: '0.75rem'
          }}>
            http://localhost:8080/oauth/callback?code=4/0AeanS...
          </code>
          <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
            Copy the <strong>code</strong> value (the part after <code>code=</code>) and paste it below:
          </p>
          <ol style={{ 
            marginLeft: '1.5rem', 
            fontSize: '0.85rem',
            lineHeight: '1.6'
          }}>
            <li>Look at the browser address bar after redirect</li>
            <li>Find the <code>code=</code> parameter in the URL</li>
            <li>Copy everything after <code>code=</code> (until the next <code>&</code> or end)</li>
            <li>Paste it in the field below</li>
          </ol>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500
            }}>
              Authorization Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="4/0AeanS... (paste the code value here)"
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--bg-secondary, #2a2a2a)',
                border: '1px solid var(--border, #333)',
                borderRadius: '6px',
                color: 'var(--text-primary, #fff)',
                fontSize: '0.875rem'
              }}
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              marginBottom: '1rem',
              color: '#ef4444',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              className="button button-text"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={loading || !code.trim()}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

