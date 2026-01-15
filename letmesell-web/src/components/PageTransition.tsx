import React from 'react';
import './PageTransition.css';

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  return (
    <div className="page-transition">
      {children}
    </div>
  );
};

