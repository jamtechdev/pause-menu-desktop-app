import React from 'react';
import { CalendarEvents } from '../common/CalendarEvents';
import './../../styles/screens.css';
import './../../styles/design-system.css';

export const Do: React.FC = () => {
  return (
    <div className="screen">
      <CalendarEvents />
    </div>
  );
};
