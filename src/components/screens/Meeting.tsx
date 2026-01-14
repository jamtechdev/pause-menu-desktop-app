import React, { useEffect, useState } from 'react';
import { useOverlayStore } from '../../stores/overlayStore';
import { api } from '../../services/api';
import './../../styles/screens.css';

interface MeetingProps {
  meetingUrl: string;
  meetingTitle?: string;
  onClose?: () => void;
}

export const Meeting: React.FC<MeetingProps> = ({ meetingUrl, meetingTitle, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Allow iframe to load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = async () => {
    if (onClose) {
      onClose();
    } else {
      // Default: hide overlay
      const store = useOverlayStore.getState();
      store.setOverlayVisible(false);
      await api.hideOverlay();
    }
  };

  return (
    <div className="screen meeting-screen" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      width: '100%',
      background: '#000'
    }}>
      {/* Header with meeting info and close button */}
      <div style={{
        padding: '1rem',
        background: 'var(--bg-secondary, #1e1e1e)',
        borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
            {meetingTitle || 'Meeting'}
          </h3>
          {meetingUrl && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {meetingUrl}
            </div>
          )}
        </div>
        <button
          onClick={handleClose}
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            color: '#fca5a5',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          Close Meeting
        </button>
      </div>

      {/* Meeting iframe */}
      <div style={{ flex: 1, position: 'relative', background: '#000' }}>
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'var(--text-primary)',
            fontSize: '1rem'
          }}>
            Loading meeting...
          </div>
        )}
        
        {error ? (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#fca5a5',
            textAlign: 'center',
            padding: '2rem'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>⚠️</div>
            <div>{error}</div>
            <button
              onClick={() => window.open(meetingUrl, '_blank')}
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Open in Browser
            </button>
          </div>
        ) : (
          <iframe
            src={meetingUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: isLoading ? 'none' : 'block'
            }}
            allow="camera; microphone; fullscreen; display-capture"
            allowFullScreen
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setError('Failed to load meeting. Some meetings may require opening in a browser.');
              setIsLoading(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

