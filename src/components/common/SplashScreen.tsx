import React from 'react';
import './../../styles/screens.css';

interface SplashScreenProps {
  appName: string;
  isVisible: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ appName, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.3s ease-in'
      }}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          padding: '3rem',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
          minWidth: '300px',
          border: '1px solid var(--border-color)'
        }}
      >
        {/* Animated spinner */}
        <div
          style={{
            width: '64px',
            height: '64px',
            border: '4px solid var(--border-color)',
            borderTop: '4px solid var(--accent-color)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }}
        />
        
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: 'var(--text-primary)'
          }}
        >
          Launching...
        </h2>
        
        <p
          style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            marginBottom: '1rem'
          }}
        >
          {appName}
        </p>
        
        <div
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-tertiary)',
            opacity: 0.7
          }}
        >
          Please wait
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

