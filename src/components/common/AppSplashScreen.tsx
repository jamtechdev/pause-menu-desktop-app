import React from 'react';
import './../../styles/screens.css';

interface AppSplashScreenProps {
  isVisible: boolean;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({ isVisible }) => {
  React.useEffect(() => {
    if (isVisible) {
      console.log('[SplashScreen] Splash screen is visible');
    } else {
      console.log('[SplashScreen] Splash screen is hidden');
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        minWidth: '100vw',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        animation: 'splashFadeIn 0.5s ease-in',
        pointerEvents: 'auto',
        margin: 0,
        padding: 0
      }}
    >
      {/* Logo/Icon */}
      <div
        style={{
          width: '120px',
          height: '120px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '2rem',
          border: '2px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          animation: 'splashPulse 2s ease-in-out infinite'
        }}
      >
        <div style={{ fontSize: '4rem' }}>⏸️</div>
      </div>

      {/* App Name */}
      <h1
        style={{
          fontSize: '3rem',
          fontWeight: 700,
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #3b82f6 0%, #9333ea 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textAlign: 'center'
        }}
      >
        Pause Menu
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: '1.125rem',
          color: 'rgba(255, 255, 255, 0.7)',
          marginBottom: '3rem',
          textAlign: 'center'
        }}
      >
        Your Productivity Command Center
      </p>

      {/* Loading Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#3b82f6',
            animation: 'splashBounce 1.4s ease-in-out infinite both',
            animationDelay: '0s'
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#9333ea',
            animation: 'splashBounce 1.4s ease-in-out infinite both',
            animationDelay: '0.2s'
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#3b82f6',
            animation: 'splashBounce 1.4s ease-in-out infinite both',
            animationDelay: '0.4s'
          }}
        />
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 12px 40px rgba(59, 130, 246, 0.5);
          }
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

