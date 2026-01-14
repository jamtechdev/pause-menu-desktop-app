import React, { useEffect, useState, useRef } from 'react';
import './../styles/overlay.css';
import './../styles/animations.css';

interface OverlayProps {
  children: React.ReactNode;
  isVisible: boolean;
}

export const Overlay: React.FC<OverlayProps> = ({ children, isVisible }) => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [isAnimating, setIsAnimating] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) {
      // Show overlay: render immediately, then animate in
      setShouldRender(true);
      // Small delay to ensure DOM is ready before animation
      requestAnimationFrame(async () => {
        setIsAnimating(true);
        
        // Aggressively focus the window and overlay
        const focusWindow = async () => {
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();
            
            // Try multiple times to ensure focus
            for (let i = 0; i < 3; i++) {
              await appWindow.setFocus();
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Focus the overlay container
            if (overlayRef.current) {
              overlayRef.current.focus();
            }
            
            // Also try window.focus() as fallback
            window.focus();
          } catch (error) {
            console.error('[Overlay] Focus error:', error);
            window.focus();
            if (overlayRef.current) {
              overlayRef.current.focus();
            }
          }
        };
        
        // Focus immediately and again after a delay
        await focusWindow();
        setTimeout(focusWindow, 300);
      });
    } else {
      // Hide overlay: animate out, then remove from DOM
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) {
    return null;
  }

  const handleFocus = async (e?: React.MouseEvent | React.FocusEvent) => {
    // CRITICAL: Don't steal focus if user is typing in an input
    const activeElement = document.activeElement;
    const isTypingInInput = activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable
    );
    
    // If user is typing in an input, don't interfere
    if (isTypingInInput) {
      return;
    }
    
    // Prevent event from bubbling if needed
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Focus window when user interacts with overlay
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.setFocus();
      // Only focus overlay if no input is focused
      if (overlayRef.current && !isTypingInInput) {
        overlayRef.current.focus();
      }
    } catch (error) {
      window.focus();
      if (overlayRef.current && !isTypingInInput) {
        overlayRef.current.focus();
      }
    }
  };

  return (
    <div 
      ref={overlayRef}
      className={`overlay-container ${isAnimating ? 'overlay-fade-in' : 'overlay-fade-out'}`}
      style={{
        display: 'flex',
        pointerEvents: 'auto',
        outline: 'none' // Remove focus outline
      }}
      tabIndex={-1} // Make focusable but don't show in tab order
      onClick={handleFocus}
      onMouseDown={handleFocus}
      onFocus={handleFocus}
      onKeyDown={async (e) => {
        // Don't prevent default here - let handlers do it
        // Just ensure focus
        await handleFocus();
        
        // Log important keys
        const importantKeys = ['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];
        if (importantKeys.includes(e.key)) {
          console.log('[Overlay] ✓✓✓ IMPORTANT KEY RECEIVED:', {
            key: e.key,
            code: e.code,
            nativeKey: (e.nativeEvent as KeyboardEvent).key,
            nativeCode: (e.nativeEvent as KeyboardEvent).code
          });
        }
        
        // Let events bubble to KeyboardNav and App handlers - don't handle here
        // This ensures all handlers get a chance to process the event
      }}
    >
      {children}
    </div>
  );
};

