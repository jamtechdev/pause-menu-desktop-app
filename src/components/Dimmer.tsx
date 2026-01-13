import React, { useEffect, useState } from 'react';
import './../styles/overlay.css';
import './../styles/animations.css';

interface DimmerProps {
  isActive: boolean;
}

export const Dimmer: React.FC<DimmerProps> = ({ isActive }) => {
  const [shouldRender, setShouldRender] = useState(isActive);
  const [isAnimating, setIsAnimating] = useState(isActive);

  useEffect(() => {
    if (isActive) {
      // Show dimmer: render immediately, then animate in
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      // Hide dimmer: animate out, then remove from DOM
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div 
      className={`dimmer ${isAnimating ? 'dimmer-fade-in' : 'dimmer-fade-out'}`}
    />
  );
};

