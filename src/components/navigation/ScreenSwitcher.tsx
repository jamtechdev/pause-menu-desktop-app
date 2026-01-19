import React from 'react';
import './../../styles/navigation.css';

export type Screen = 'continue' | 'do' | 'jump' | 'focus' | 'windows' | 'recent-files' | 'launch' | 'documents' | 'profile';

interface ScreenSwitcherProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export const ScreenSwitcher: React.FC<ScreenSwitcherProps> = ({
  currentScreen,
  onScreenChange,
}) => {
  const screens: { id: Screen; label: string; icon: string }[] = [
    { id: 'continue', label: 'Continue', icon: '▶' },
    { id: 'do', label: 'Do', icon: '✓' },
    { id: 'jump', label: 'Jump', icon: '↗' },
    { id: 'focus', label: 'Focus', icon: '🎯' },
    // { id: 'launch', label: 'Launch', icon: '🚀' }, // Commented out for now
    { id: 'windows', label: 'Windows', icon: '🪟' },
    { id: 'recent-files', label: 'Files', icon: '📁' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <nav className="nav-tabs">
        {screens.map((screen) => (
          <button
            key={screen.id}
            className={`nav-tab ${currentScreen === screen.id ? 'active' : ''}`}
            onClick={() => onScreenChange(screen.id)}
            title={screen.label}
          >
            <span style={{ marginRight: 'var(--space-2)' }}>{screen.icon}</span>
            {screen.label}
          </button>
        ))}
      </nav>
      {/* Visual dots indicator */}
      <div style={{
        display: 'flex',
        gap: '6px',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '4px 0'
      }}>
        {screens.map((screen) => (
          <div
            key={screen.id}
            className={`nav-dot ${currentScreen === screen.id ? 'active' : ''}`}
            onClick={() => onScreenChange(screen.id)}
            title={screen.label}
            style={{
              width: currentScreen === screen.id ? '8px' : '6px',
              height: currentScreen === screen.id ? '8px' : '6px',
              borderRadius: '50%',
              background: currentScreen === screen.id 
                ? 'var(--accent, #3b82f6)' 
                : 'rgba(255, 255, 255, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: currentScreen === screen.id 
                ? '2px solid var(--accent, #3b82f6)' 
                : '2px solid transparent'
            }}
          />
        ))}
      </div>
    </div>
  );
};
