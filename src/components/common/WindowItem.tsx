import React from 'react';

export interface WindowInfo {
  id: string;
  title: string;
  processName: string;
  icon?: string;
}

interface WindowItemProps {
  window: WindowInfo;
  onClick?: () => void;
}

export const WindowItem: React.FC<WindowItemProps> = ({ window, onClick }) => {
  return (
    <div className="window-item" onClick={onClick}>
      {window.icon && <img src={window.icon} alt={window.processName} />}
      <div>
        <div className="window-title">{window.title}</div>
        <div className="window-process">{window.processName}</div>
      </div>
    </div>
  );
};

