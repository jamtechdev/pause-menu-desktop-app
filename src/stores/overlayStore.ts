import { create } from 'zustand';
import { Screen } from '../components/navigation/ScreenSwitcher';

interface OverlayState {
  // Current screen state
  currentScreen: Screen;
  // Overlay visibility state
  isOverlayVisible: boolean;
  // Keyboard navigation state
  isKeyboardNavActive: boolean;
  // Actions
  setCurrentScreen: (screen: Screen) => void;
  setOverlayVisible: (visible: boolean) => void;
  toggleOverlay: () => void;
  setKeyboardNavActive: (active: boolean) => void;
  // Navigation helpers
  navigateToScreen: (screenNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7) => void;
}

// All screens in order for 1-8 navigation
// Matches the order in ScreenSwitcher: continue, do, jump, focus, launch, windows, recent-files, documents
const ALL_SCREENS: Screen[] = ['continue', 'do', 'jump', 'focus', 'launch', 'windows', 'recent-files', 'documents'];

export const useOverlayStore = create<OverlayState>((set) => ({
  // Initial state
  currentScreen: 'continue',
  isOverlayVisible: true,
  isKeyboardNavActive: false,

  // Actions
  setCurrentScreen: (screen: Screen) => {
    set({ currentScreen: screen });
  },

  setOverlayVisible: (visible: boolean) => {
    set({ isOverlayVisible: visible });
  },

  toggleOverlay: () => {
    set((state) => ({ isOverlayVisible: !state.isOverlayVisible }));
  },

  setKeyboardNavActive: (active: boolean) => {
    set({ isKeyboardNavActive: active });
  },

  // Navigate to screen by number (1-8)
  navigateToScreen: (screenNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) => {
    const screen = ALL_SCREENS[screenNumber - 1];
    if (screen) {
      set({ currentScreen: screen });
    }
  },
}));

