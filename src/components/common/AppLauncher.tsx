import React from 'react';

export interface AppInfo {
  id: string;
  name: string;
  path: string;
  icon?: string;
}

interface AppLauncherProps {
  app: AppInfo;
  onClick?: () => void;
}

export const AppLauncher: React.FC<AppLauncherProps> = ({ app, onClick }) => {
  return (
    <div className="app-launcher" onClick={onClick}>
      {app.icon && <img src={app.icon} alt={app.name} />}
      <div className="app-name">{app.name}</div>
    </div>
  );
};

