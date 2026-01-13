import React from 'react';
import './../../styles/screens.css';
import './../../styles/design-system.css';

export const Jump: React.FC = () => {
  return (
    <div className="screen">
      <div className="empty-state">
        <div className="empty-state-icon">↗</div>
        <div className="empty-state-title">Jump</div>
        <div className="empty-state-description">Quick navigation and shortcuts will appear here</div>
      </div>
    </div>
  );
};
