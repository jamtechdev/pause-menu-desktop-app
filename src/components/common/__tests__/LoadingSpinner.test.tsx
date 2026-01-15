import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render loading spinner', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('should render with default size', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toHaveClass('loading-spinner-md');
  });

  it('should apply custom size', () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toHaveClass('loading-spinner-lg');
  });

  it('should apply custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);
    const spinner = container.querySelector('.loading-spinner');
    expect(spinner).toHaveClass('custom-class');
  });

  it('should render multiple spinner rings', () => {
    const { container } = render(<LoadingSpinner />);
    const rings = container.querySelectorAll('.spinner-ring');
    expect(rings.length).toBe(3);
  });
});

