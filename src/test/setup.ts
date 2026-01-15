import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri APIs
global.window = {
  ...global.window,
  __TAURI_INTERNALS__: {},
};

// Mock @tauri-apps/api
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    label: 'main',
    setFocus: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
  unregisterAll: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
  Command: vi.fn(),
}));

