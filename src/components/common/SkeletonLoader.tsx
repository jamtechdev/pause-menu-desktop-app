import React from 'react';
import '../../styles/components.css';

interface SkeletonLoaderProps {
  width?: string;
  height?: string;
  className?: string;
  lines?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  lines = 1,
}) => {
  if (lines > 1) {
    return (
      <div className={`skeleton-container ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton-line"
            style={{
              width: i === lines - 1 ? '80%' : width,
              height,
              marginBottom: i < lines - 1 ? '0.5rem' : '0',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
    />
  );
};

