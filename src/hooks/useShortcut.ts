import { useEffect } from 'react';
import { api } from '../services/api';

export const useShortcut = (shortcut: string, callback: () => void) => {
  useEffect(() => {
    const register = async () => {
      try {
        await api.registerShortcut(shortcut);
        // TODO: Set up event listener for shortcut
      } catch (error) {
        console.error('Failed to register shortcut:', error);
      }
    };

    register();
  }, [shortcut, callback]);
};

