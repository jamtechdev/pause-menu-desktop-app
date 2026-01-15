import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFocus } from '../useFocus';
import { api } from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => ({
  api: {
    isFocusActive: vi.fn(),
    getCurrentFocusSession: vi.fn(),
    getFocusRemainingSeconds: vi.fn(),
    startFocusMode: vi.fn(),
    stopFocusMode: vi.fn(),
  },
}));

describe('useFocus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with inactive state', () => {
    (api.isFocusActive as any).mockResolvedValue(false);
    const { result } = renderHook(() => useFocus());
    
    expect(result.current.isActive).toBe(false);
    expect(result.current.remainingSeconds).toBeNull();
  });

  it('should check for active session on mount', async () => {
    (api.isFocusActive as any).mockResolvedValue(true);
    (api.getCurrentFocusSession as any).mockResolvedValue({
      duration_minutes: 25,
      remaining_seconds: 1500,
    });

    const { result } = renderHook(() => useFocus());

    await waitFor(() => {
      expect(api.isFocusActive).toHaveBeenCalled();
    });
  });

  it('should restore active session state on mount', async () => {
    (api.isFocusActive as any).mockResolvedValue(true);
    (api.getCurrentFocusSession as any).mockResolvedValue({
      duration_minutes: 25,
      remaining_seconds: 1500,
    });

    const { result } = renderHook(() => useFocus());

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });

    expect(result.current.duration).toBe(25);
    expect(result.current.remainingSeconds).toBe(1500);
  });

  it('should start focus mode', async () => {
    (api.isFocusActive as any).mockResolvedValue(false);
    (api.startFocusMode as any).mockResolvedValue({
      duration_minutes: 25,
      remaining_seconds: 1500,
    });

    const { result } = renderHook(() => useFocus());

    await result.current.startFocus('focus25');

    expect(api.startFocusMode).toHaveBeenCalledWith('focus25', undefined);
    expect(result.current.isActive).toBe(true);
    expect(result.current.duration).toBe(25);
  });

  it('should start custom focus mode', async () => {
    (api.isFocusActive as any).mockResolvedValue(false);
    (api.startFocusMode as any).mockResolvedValue({
      duration_minutes: 30,
      remaining_seconds: 1800,
    });

    const { result } = renderHook(() => useFocus());

    await result.current.startFocus('custom', 30);

    expect(api.startFocusMode).toHaveBeenCalledWith('custom', 30);
  });

  it('should stop focus mode', async () => {
    (api.isFocusActive as any).mockResolvedValue(true);
    (api.getCurrentFocusSession as any).mockResolvedValue({
      duration_minutes: 25,
      remaining_seconds: 1500,
    });
    (api.stopFocusMode as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFocus());

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });

    await result.current.stopFocus();

    expect(api.stopFocusMode).toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
    expect(result.current.remainingSeconds).toBeNull();
  });

  it('should poll for remaining seconds when active', async () => {
    (api.isFocusActive as any).mockResolvedValue(true);
    (api.getCurrentFocusSession as any).mockResolvedValue({
      duration_minutes: 25,
      remaining_seconds: 1500,
    });
    (api.getFocusRemainingSeconds as any).mockResolvedValue(1400);

    const { result } = renderHook(() => useFocus());

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });

    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(api.getFocusRemainingSeconds).toHaveBeenCalled();
    });
  });
});

