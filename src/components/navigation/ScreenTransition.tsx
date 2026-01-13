import React, { useEffect, useState } from 'react';
import './../../styles/animations.css';

interface ScreenTransitionProps {
  children: React.ReactNode;
  screenKey: string;
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({ 
  children, 
  screenKey 
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Reset animation state when screen changes
    setIsAnimating(false);
    
    // Trigger enter animation after a brief delay to ensure DOM is ready
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    });

    return () => {
      cancelAnimationFrame(timer);
    };
  }, [screenKey]);

  return (
    <div
      className={`screen-transition ${isAnimating ? 'screen-enter-active' : 'screen-enter'}`}
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      {children}
    </div>
  );
};

