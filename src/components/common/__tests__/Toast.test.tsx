import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastItem } from '../Toast';

describe('ToastItem', () => {
  const mockToast = {
    id: '1',
    message: 'Test message',
    type: 'success' as const,
  };

  it('should render toast message', () => {
    render(<ToastItem toast={mockToast} onClose={vi.fn()} />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should apply success type styling', () => {
    const { container } = render(
      <ToastItem toast={{ ...mockToast, type: 'success' }} onClose={vi.fn()} />
    );
    const toast = container.querySelector('.toast');
    expect(toast).toHaveClass('toast-success');
  });

  it('should apply error type styling', () => {
    const { container } = render(
      <ToastItem toast={{ ...mockToast, type: 'error' }} onClose={vi.fn()} />
    );
    const toast = container.querySelector('.toast');
    expect(toast).toHaveClass('toast-error');
  });

  it('should apply info type styling', () => {
    const { container } = render(
      <ToastItem toast={{ ...mockToast, type: 'info' }} onClose={vi.fn()} />
    );
    const toast = container.querySelector('.toast');
    expect(toast).toHaveClass('toast-info');
  });

  it('should call onClose when clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ToastItem toast={mockToast} onClose={onClose} />);
    
    const toast = screen.getByText('Test message');
    await user.click(toast);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should auto-close after duration', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<ToastItem toast={mockToast} onClose={onClose} duration={1000} />);
    
    // Advance past the initial visibility timeout (10ms)
    vi.advanceTimersByTime(20);
    
    // Advance to the auto-close duration (1000ms)
    vi.advanceTimersByTime(1000);
    
    // Advance past the fade-out delay (300ms)
    vi.advanceTimersByTime(300);
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    }, { timeout: 100 });
    
    vi.useRealTimers();
  });
});

