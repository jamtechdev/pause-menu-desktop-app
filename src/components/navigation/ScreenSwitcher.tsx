import React from 'react';
import './../../styles/navigation.css';

export type Screen = 'continue' | 'do' | 'jump' | 'focus' | 'windows' | 'recent-files' | 'launch';

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
    { id: 'launch', label: 'Launch', icon: '🚀' },
    { id: 'windows', label: 'Windows', icon: '🪟' },
    { id: 'recent-files', label: 'Files', icon: '📁' },
  ];

  return (
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
  );
};
