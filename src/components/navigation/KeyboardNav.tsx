import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useOverlayStore } from '../../stores/overlayStore';
import { Screen } from './ScreenSwitcher';

interface KeyboardNavProps {
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right' | 'enter') => void;
}

export const KeyboardNav: React.FC<KeyboardNavProps> = ({ onNavigate }) => {
  const isOverlayVisible = useOverlayStore((state) => state.isOverlayVisible);
  const setOverlayVisible = useOverlayStore((state) => state.setOverlayVisible);
  const navigateToScreen = useOverlayStore((state) => state.navigateToScreen);
  const setKeyboardNavActive = useOverlayStore((state) => state.setKeyboardNavActive);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Only handle keys when overlay is visible
      if (!isOverlayVisible) {
        return;
      }

      // CRITICAL: Check if typing in input - MUST be FIRST check
      // Simple, direct check - is target an input?
      const target = e.target as HTMLElement;
      const activeElement = document.activeElement;
      
      const isInput = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      
      const activeIsInput = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );
      
      // If either is true, we're typing in an input - do NOTHING
      if (isInput || activeIsInput) {
        // For ALL keys when typing in input, do NOTHING
        // Don't prevent default, don't stop propagation, just return
        return;
      }

      // Log important keys for debugging
      const importantKeys = ['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];
      if (importantKeys.includes(e.key)) {
        console.log('[KeyboardNav] ✓✓✓ IMPORTANT KEY:', {
          key: e.key,
          code: e.code,
          overlayVisible: isOverlayVisible,
          hasFocus: document.hasFocus()
        });
      }

      // Handle Escape key first (highest priority) - check multiple ways
      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[KeyboardNav] ✓✓✓ ESCAPE PRESSED - CLOSING OVERLAY ✓✓✓', {
          key: e.key,
          code: e.code,
          keyCode: e.keyCode
        });
        setKeyboardNavActive(false);
        setOverlayVisible(false);
        try {
          await invoke('hide_overlay');
          console.log('[KeyboardNav] ✓ hide_overlay command executed successfully');
        } catch (error) {
          console.error('[KeyboardNav] ✗ Failed to hide overlay:', error);
        }
        return; // Exit early
      }

      // Handle Arrow keys - prevent default FIRST
      if (e.key.startsWith('Arrow') || e.code.startsWith('Arrow')) {
        const direction = (e.key.replace('Arrow', '') || e.code.replace('Arrow', '')).toLowerCase() as 'up' | 'down' | 'left' | 'right';
        
        // Arrow Left/Right: Let App.tsx handle screen navigation (to avoid conflicts)
        // We only handle Arrow Up/Down here for within-screen navigation
        if (direction === 'left' || direction === 'right') {
          // Don't handle left/right here - let App.tsx handle it
          // Just prevent default to avoid browser navigation
          e.preventDefault();
          e.stopPropagation();
          console.log('[KeyboardNav] Arrow Left/Right detected - letting App.tsx handle screen navigation');
          return; // Let App.tsx handle this
        }
        
        // Arrow Up/Down: Use for within-screen navigation
        e.preventDefault();
        e.stopPropagation();
        console.log('[KeyboardNav] ✓✓✓ ARROW UP/DOWN PRESSED:', e.key, e.code);
        setKeyboardNavActive(true);
        onNavigate(direction);
        return;
      }

      // Handle Enter
      if (e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[KeyboardNav] ✓✓✓ ENTER PRESSED');
        setKeyboardNavActive(true);
        onNavigate('enter');
        return;
      }

      // Handle Tab key - navigate to next item (same as ArrowDown)
      if (e.key === 'Tab' || e.code === 'Tab' || e.keyCode === 9) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[KeyboardNav] ✓✓✓ TAB PRESSED - Navigating to next item');
        setKeyboardNavActive(true);
        // Tab = next item (down), Shift+Tab = previous item (up)
        if (e.shiftKey) {
          onNavigate('up');
        } else {
          onNavigate('down');
        }
        return;
      }
    };

    // Always attach listener, but check visibility inside
    // Use capture phase to catch events early
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    
    console.log('[KeyboardNav] Event listeners attached, overlay visible:', isOverlayVisible);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverlayVisible]); // Only depend on isOverlayVisible to prevent recreation

  return null;
};

