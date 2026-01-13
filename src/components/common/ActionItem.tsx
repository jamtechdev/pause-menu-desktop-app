import React from 'react';

export interface ActionInfo {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

interface ActionItemProps {
  action: ActionInfo;
  onClick?: () => void;
}

export const ActionItem: React.FC<ActionItemProps> = ({ action, onClick }) => {
  return (
    <div className="action-item" onClick={onClick}>
      {action.icon && <img src={action.icon} alt={action.label} />}
      <div>
        <div className="action-label">{action.label}</div>
        {action.description && (
          <div className="action-description">{action.description}</div>
        )}
      </div>
    </div>
  );
};

