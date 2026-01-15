import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShortcut } from '../useShortcut';
import { api } from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => ({
  api: {
    registerShortcut: vi.fn(),
  },
}));

describe('useShortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register shortcut on mount', async () => {
    const callback = vi.fn();
    const shortcut = 'Ctrl+Space';

    renderHook(() => useShortcut(shortcut, callback));

    // Wait for async registration
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(api.registerShortcut).toHaveBeenCalledWith(shortcut);
  });

  it('should re-register when shortcut changes', async () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ shortcut }) => useShortcut(shortcut, callback),
      { initialProps: { shortcut: 'Ctrl+Space' } }
    );

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api.registerShortcut).toHaveBeenCalledTimes(1);

    rerender({ shortcut: 'Ctrl+K' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api.registerShortcut).toHaveBeenCalledTimes(2);
    expect(api.registerShortcut).toHaveBeenLastCalledWith('Ctrl+K');
  });

  it('should handle registration errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const callback = vi.fn();
    const shortcut = 'Ctrl+Space';

    (api.registerShortcut as any).mockRejectedValueOnce(new Error('Registration failed'));

    renderHook(() => useShortcut(shortcut, callback));

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to register shortcut:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});

