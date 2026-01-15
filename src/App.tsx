import React, { useState, useEffect } from 'react';
import { Overlay } from './components/Overlay';
import { Dimmer } from './components/Dimmer';
import { ScreenSwitcher, Screen } from './components/navigation/ScreenSwitcher';
import { KeyboardNav } from './components/navigation/KeyboardNav';
import { ScreenTransition } from './components/navigation/ScreenTransition';
import { AppSplashScreen } from './components/common/AppSplashScreen';
import { Continue } from './components/screens/Continue';
import { Do } from './components/screens/Do';
import { Jump } from './components/screens/Jump';
import { Focus } from './components/screens/Focus';
import { Launch } from './components/screens/Launch';
import { Windows } from './components/screens/Windows';
import { RecentFiles } from './components/screens/RecentFiles';
import { Documents } from './components/screens/Documents';
import { Profile } from './components/screens/Profile';
import { useOverlayStore } from './stores/overlayStore';
import { useAuthStore } from './stores/authStore';
import { Login } from './components/screens/Login';
import { authService } from './services/auth';
import './App.css';
import './styles/overlay.css';
import './styles/screens.css';
import './styles/animations.css';
import './styles/navigation.css';

function App() {
  const {
    currentScreen,
    isOverlayVisible,
    setCurrentScreen,
    setOverlayVisible,
    toggleOverlay,
  } = useOverlayStore();
  const { isAuthenticated, token, user, setLoading, logout, login } = useAuthStore();
  const [showSplash, setShowSplash] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check authentication on app startup
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check if server is available
        const serverAvailable = await authService.checkServerHealth();
        if (!serverAvailable) {
          console.warn('[App] Server is not available - showing login screen');
          // Don't try to validate token if server isn't running
          setCheckingAuth(false);
          setLoading(false);
          return;
        }
        
        if (token) {
          try {
            setLoading(true);
            // Validate token by fetching user profile and restore session
            const userData = await authService.getCurrentUser(token);
            if (userData && userData.id) {
              // Token is valid, ensure user is logged in with fresh data
              console.log('[App] Token valid, restoring user session:', userData.email);
              login(userData, token);
              console.log('[App] User session restored successfully');
            } else {
              // Token is invalid, logout
              console.log('[App] Token invalid - no user data returned, logging out');
              logout();
            }
          } catch (error: any) {
            console.error('[App] Auth check failed:', error);
            // If it's a connection error, just show login - don't crash
            if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
              console.warn('[App] Connection error - server may not be running');
              logout(); // Show login screen
            } else {
              // Token is invalid or expired
              console.log('[App] Token validation failed, logging out');
              logout();
            }
          } finally {
            setLoading(false);
            setCheckingAuth(false);
          }
        } else {
          // No token, just set checking to false
          setCheckingAuth(false);
        }
      } catch (error) {
        // Catch any unexpected errors to prevent crashes
        console.error('[App] Unexpected error during auth check:', error);
        setCheckingAuth(false);
        setLoading(false);
      }
    };

    // Add a small delay to ensure app is fully initialized
    const timer = setTimeout(() => {
      checkAuth();
    }, 100);

    return () => clearTimeout(timer);
  }, []); // Only run on mount

  // Show splash screen for 2 seconds on app startup
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000); // 2 seconds

    return () => clearTimeout(splashTimer);
  }, []);

  // Note: Number key shortcuts are NOT registered as global shortcuts
  // to avoid conflicts with Windows system shortcuts (which trigger Quick Settings/Start Menu)
  // Number keys are handled via JavaScript keyboard events when overlay is visible

  // Aggressive focus management when overlay is visible
  useEffect(() => {
    if (!isOverlayVisible) {
      return;
    }

    let focusInterval: NodeJS.Timeout | null = null;
    let focusTimeout: NodeJS.Timeout | null = null;

    const ensureFocus = async () => {
      try {
        // CRITICAL: Don't steal focus if user is typing in an input
        const activeElement = document.activeElement;
        const isTypingInInput = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
        );
        
        // If user is typing, don't interfere with focus
        if (isTypingInInput) {
          return;
        }
        
        // Use Tauri window API to focus the window
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        
        // CRITICAL: Only focus if this is the primary monitor window (overlay_monitor_0) or main window
        // This prevents split typing in multi-monitor setups where multiple windows receive input
        const windowLabel = appWindow.label || '';
        const isPrimaryMonitor = windowLabel === 'overlay_monitor_0' || windowLabel === 'main';
        
        if (!isPrimaryMonitor) {
          // This is a secondary monitor window - don't focus it to prevent keyboard input
          console.log('[App] Skipping focus for secondary monitor window:', windowLabel);
          return;
        }
        
        await appWindow.setFocus();
        
        // Only focus overlay container if no input is focused
        // This prevents stealing focus from inputs
        const overlay = document.querySelector('.overlay-container') as HTMLElement;
        if (overlay && !isTypingInInput) {
          overlay.focus();
        }
        
        // Verify focus
        if (!document.hasFocus()) {
          console.warn('[App] Window still not focused after setFocus()');
          window.focus();
        }
      } catch (error) {
        console.error('[App] Focus error:', error);
        // Only try to focus if document has focus (meaning this window might be the active one)
        // And if user is not typing in an input
        const activeElement = document.activeElement;
        const isTypingInInput = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
        );
        
        if (document.hasFocus() && !isTypingInInput) {
          window.focus();
          const overlay = document.querySelector('.overlay-container') as HTMLElement;
          if (overlay) {
            overlay.focus();
          }
        }
      }
    };

    // Initial focus after a short delay
    focusTimeout = setTimeout(ensureFocus, 100);

    // Continuously maintain focus every 500ms while overlay is visible
    // This ensures keyboard events are always captured
    focusInterval = setInterval(ensureFocus, 500);

    // Also refocus when window becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden && isOverlayVisible) {
        ensureFocus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (focusTimeout) clearTimeout(focusTimeout);
      if (focusInterval) clearInterval(focusInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOverlayVisible]);

  useEffect(() => {
    // Listen for global shortcut trigger event
    const setupShortcutListener = async () => {
      try {
        console.log('Setting up shortcut listener...');
        const { listen } = await import('@tauri-apps/api/event');
        
        // Listen for shortcut-triggered (Ctrl+Space)
        const unlistenShortcut = await listen('shortcut-triggered', (event: any) => {
          const shouldBeVisible = event.payload as boolean;
          console.log('Shortcut triggered! Event received:', event);
          console.log('Setting overlay visibility to:', shouldBeVisible);
          setOverlayVisible(shouldBeVisible);
        });

        // Listen for number key presses (1-8)
        const unlistenNumberKey = await listen('number-key-pressed', (event: any) => {
          const screenNum = event.payload as number;
          console.log('[App] Number key pressed:', screenNum);
          const store = useOverlayStore.getState();
          if (store.isOverlayVisible) {
            store.navigateToScreen(screenNum as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8);
          }
        });
        
        // Listen for arrow key presses (from global shortcuts)
        // This works across all monitor windows since Tauri events are app-wide
        const unlistenArrowKey = await listen('arrow-key-pressed', (event: any) => {
          const direction = event.payload as string;
          console.log('[App] Arrow key pressed (global shortcut):', direction);
          const store = useOverlayStore.getState();
          if (store.isOverlayVisible) {
            // Handle arrow left/right for screen navigation (works on all monitors)
            if (direction === 'left' || direction === 'right') {
              // Use the same screen order as ScreenSwitcher and overlayStore
              // Order: continue, do, jump, focus, launch, windows, recent-files, documents
              const allScreens: Screen[] = ['continue', 'do', 'jump', 'focus', 'launch', 'windows', 'recent-files', 'documents'];
              const currentScreen = store.currentScreen;
              const currentIndex = allScreens.indexOf(currentScreen);
              
              console.log('[App] Global shortcut arrow navigation - Current:', currentScreen, 'Index:', currentIndex, 'Direction:', direction);
              
              if (currentIndex === -1) {
                console.error('[App] ERROR: Current screen', currentScreen, 'not found in screens array!');
                console.error('[App] Available screens:', allScreens);
                // Default to first screen
                store.setCurrentScreen(allScreens[0]);
                store.setKeyboardNavActive(true);
                return;
              }
              
              // Calculate next/previous index sequentially
              let newIndex: number;
              if (direction === 'left') {
                // Previous screen (wrap around from first to last)
                newIndex = currentIndex === 0 ? allScreens.length - 1 : currentIndex - 1;
              } else {
                // Next screen (wrap around from last to first)
                newIndex = currentIndex === allScreens.length - 1 ? 0 : currentIndex + 1;
              }
              
              const newScreen = allScreens[newIndex];
              console.log('[App] ✓ Global shortcut sequential navigation: Screen', currentIndex + 1, '(', allScreens[currentIndex], ') -> Screen', newIndex + 1, '(', newScreen, ')');
              
              // Set the new screen (this updates Zustand store, which is shared across all windows)
              store.setCurrentScreen(newScreen);
              store.setKeyboardNavActive(true);
              return;
            }
            
            // For arrow up/down, dispatch navigation event for within-screen navigation
            const navEvent = new CustomEvent('overlay-navigate', {
              detail: { direction },
              bubbles: true,
              cancelable: true
            });
            window.dispatchEvent(navEvent);
            document.dispatchEvent(navEvent);
          }
        });

        console.log('Shortcut listeners set up successfully');
        return () => {
          unlistenShortcut();
          unlistenNumberKey();
          unlistenArrowKey();
        };
      } catch (error) {
        console.error('Failed to setup shortcut listener:', error);
        return () => {};
      }
    };

    let unlistenFn: (() => void) | null = null;
    
    setupShortcutListener().then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [setOverlayVisible]);

  const handleScreenChange = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const handleNavigate = (direction: 'up' | 'down' | 'left' | 'right' | 'enter') => {
    // Keyboard navigation for within-screen navigation
    // This will be handled by individual screen components
    // For now, we'll emit a custom event that screens can listen to
    console.log('[App] Navigate:', direction);
    
    // Dispatch a custom event that screen components can listen to
    // Only dispatch to window to avoid duplicate events
    const event = new CustomEvent('overlay-navigate', {
      detail: { direction },
      bubbles: false, // Don't bubble to avoid duplicate handling
      cancelable: true
    });
    window.dispatchEvent(event);
  };

  // Global keyboard handler at App level - always active
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Get current state from store
      const store = useOverlayStore.getState();
      
      // Only handle keys when overlay is visible
      if (!store.isOverlayVisible) {
        return;
      }

      // CRITICAL: Check if typing in input - MUST be FIRST check
      // Check target FIRST (most reliable in capture phase)
      const target = e.target as HTMLElement;
      const activeElement = document.activeElement;
      
      // Simple, direct check - is target an input?
      const isInput = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input') ||
        target.closest('textarea')
      );
      
      // Also check active element
      const activeIsInput = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable ||
        (activeElement as HTMLElement).closest?.('input') ||
        (activeElement as HTMLElement).closest?.('textarea')
      );
      
      // If either is true, we're typing in an input
      if (isInput || activeIsInput) {
        // For ALL keys when typing in input, do NOTHING
        // Don't prevent default, don't stop propagation, just return
        // This allows the input to handle everything normally
        console.log('[App] Input focused - ignoring key:', e.key);
        return;
      }

      // Log important keys for debugging (not all keys to reduce noise)
      const importantKeys = ['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];
      if (importantKeys.includes(e.key)) {
        console.log('[App] ✓✓✓ IMPORTANT KEY PRESSED:', {
          key: e.key,
          code: e.code,
          overlayVisible: store.isOverlayVisible,
          hasFocus: document.hasFocus(),
          target: e.target
        });
      }

      // Handle Escape key first (highest priority) - check both key and code
      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[App] ✓✓✓ ESCAPE PRESSED - CLOSING OVERLAY ✓✓✓', {
          key: e.key,
          code: e.code,
          keyCode: e.keyCode
        });
        store.setKeyboardNavActive(false);
        store.setOverlayVisible(false);
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('hide_overlay');
          console.log('[App] ✓ hide_overlay command executed successfully');
        } catch (error) {
          console.error('[App] ✗ Failed to hide overlay:', error);
        }
        return; // Exit early, don't process other keys
      }
      
      // Handle Arrow keys - only when NOT typing in an input
      if (e.key.startsWith('Arrow') || e.code.startsWith('Arrow')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[App] ✓✓✓ ARROW KEY PRESSED:', e.key, e.code);
        const direction = (e.key.replace('Arrow', '') || e.code.replace('Arrow', '')).toLowerCase() as 'up' | 'down' | 'left' | 'right';
        
        // Arrow Left/Right: Navigate between screens (tabs) sequentially
        if (direction === 'left' || direction === 'right') {
          // Import the screen order from overlayStore to ensure consistency
          // Order: continue, do, jump, focus, launch, windows, recent-files
          const allScreens: Screen[] = ['continue', 'do', 'jump', 'focus', 'launch', 'windows', 'recent-files'];
          const currentScreen = store.currentScreen;
          const currentIndex = allScreens.indexOf(currentScreen);
          
          console.log('[App] Arrow navigation - Current:', currentScreen, 'Index:', currentIndex, 'Direction:', direction);
          
          if (currentIndex === -1) {
            console.error('[App] ERROR: Current screen', currentScreen, 'not found in screens array!');
            console.error('[App] Available screens:', allScreens);
            // Default to first screen
            store.setCurrentScreen(allScreens[0]);
            store.setKeyboardNavActive(true);
            return;
          }
          
          // Calculate next/previous index sequentially
          let newIndex: number;
          if (direction === 'left') {
            // Previous screen (wrap around from first to last)
            newIndex = currentIndex === 0 ? allScreens.length - 1 : currentIndex - 1;
          } else {
            // Next screen (wrap around from last to first)
            newIndex = currentIndex === allScreens.length - 1 ? 0 : currentIndex + 1;
          }
          
          const newScreen = allScreens[newIndex];
          console.log('[App] ✓ Sequential navigation: Screen', currentIndex + 1, '(', allScreens[currentIndex], ') -> Screen', newIndex + 1, '(', newScreen, ')');
          
          // Set the new screen
          store.setCurrentScreen(newScreen);
          store.setKeyboardNavActive(true);
          return;
        }
        
        // Arrow Up/Down: Let KeyboardNav handle it to avoid duplicate event dispatching
        // KeyboardNav will dispatch the overlay-navigate event for screen components
        if (direction === 'up' || direction === 'down') {
          // Don't handle here - let KeyboardNav handle it
          // Just prevent default to avoid browser scrolling
          return;
        }
        
        return;
      }

      // Prevent default for navigation keys (only when NOT typing in input)
      // Note: We already handled arrow keys above, so this is for number keys and Enter
      // BUT: Don't prevent default if input is focused (already checked above)
      const navigationKeys = [
        'Enter', '1', '2', '3', '4', '5', '6', '7', '8'
      ];
      
      // Only prevent default for navigation keys if input is NOT focused
      // (We already returned early if input is focused, so this is safe)
      if (navigationKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }

      const hasFocus = document.hasFocus();
      console.log('[App] Key pressed:', e.key, 'Overlay visible:', store.isOverlayVisible, 'Window focused:', hasFocus);
      
      // If window doesn't have focus, try to refocus before processing
      if (!hasFocus) {
        console.warn('[App] Window does not have focus! Attempting to refocus...');
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();
          await appWindow.setFocus();
          // Small delay to let focus settle
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          window.focus();
        }
      }

      switch (e.key) {
        case '1':
          console.log('[App] Navigating to screen 1 (Continue)');
          store.setKeyboardNavActive(true);
          store.navigateToScreen(1);
          break;
        case '2':
          console.log('[App] Navigating to screen 2 (Do)');
          store.setKeyboardNavActive(true);
          store.navigateToScreen(2);
          break;
        case '3':
          console.log('[App] Navigating to screen 3 (Jump)');
          store.setKeyboardNavActive(true);
          store.navigateToScreen(3);
          break;
        case '4':
          console.log('[App] Navigating to screen 4 (Focus)');
          store.setKeyboardNavActive(true);
          store.navigateToScreen(4);
          break;
        case '5':
          console.log('[App] Navigating to screen 5 (Launch)');
          store.setKeyboardNavActive(true);
          store.navigateToScreen(5);
          break;
        case '6':
          console.log('[App] Navigating to screen 6 (Windows)');
          store.setKeyboardNavActive(true);
          store.navigateToScreen(6);
          break;
        case '7':
          console.log('[App] Navigating to screen 7 (Recent Files)');
          store.setKeyboardNavActive(true);
          store.navigateToScreen(7);
          break;
        case '8':
          console.log('[App] Navigating to screen 8 (Documents)');
          store.setKeyboardNavActive(true);
          store.navigateToScreen(8);
          break;
        case '9':
          console.log('[App] Navigating to screen 9 (Profile)');
          store.setKeyboardNavActive(true);
          store.navigateToScreen(9);
          break;
      }
    };

    // Always attach listener at window level with capture phase
    // This ensures we catch events even if window doesn't have focus
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    
    // Also attach to body to catch events early
    const body = document.body;
    if (body) {
      body.addEventListener('keydown', handleKeyDown, true);
    }
    
    console.log('[App] Global keyboard listeners attached');
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      if (body) {
        body.removeEventListener('keydown', handleKeyDown, true);
      }
    };
  }, []); // Empty deps - use getState() to get current values

  // Show login screen if not authenticated
  if (checkingAuth) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <div style={{
          color: 'white',
          fontSize: '18px',
        }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'continue':
        return <Continue onToggleOverlay={toggleOverlay} />;
      case 'do':
        return <Do />;
      case 'jump':
        return <Jump />;
      case 'focus':
        return <Focus />;
      case 'launch':
        return <Launch />;
      case 'windows':
        return <Windows />;
      case 'recent-files':
        return <RecentFiles />;
      case 'documents':
        return <Documents />;
      case 'profile':
        return <Profile />;
      default:
        return <Continue onToggleOverlay={toggleOverlay} />;
    }
  };

  return (
    <>
      <AppSplashScreen isVisible={showSplash} />
      {!showSplash && (
        <main className="container">
          <Dimmer isActive={isOverlayVisible} />
          <Overlay isVisible={isOverlayVisible}>
        <div className="command-center">
          <div className="command-center-header">
            <ScreenSwitcher
              currentScreen={currentScreen}
              onScreenChange={handleScreenChange}
            />
          </div>
          <div className="command-center-body">
            <KeyboardNav onNavigate={handleNavigate} />
            <ScreenTransition screenKey={currentScreen}>
              {renderScreen()}
            </ScreenTransition>
          </div>
          <div className="command-center-footer">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Press <kbd style={{ padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px', fontSize: '11px' }}>Ctrl+Space</kbd> to toggle</span>
              <span>Press <kbd style={{ padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px', fontSize: '11px' }}>1-8</kbd> to switch screens</span>
              <span>Press <kbd style={{ padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px', fontSize: '11px' }}>← →</kbd> to navigate screens</span>
              <span>Press <kbd style={{ padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px', fontSize: '11px' }}>↑ ↓</kbd> or <kbd style={{ padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px', fontSize: '11px' }}>Tab</kbd> to navigate items</span>
              <span>Press <kbd style={{ padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px', fontSize: '11px' }}>Enter</kbd> to select</span>
              <span>Press <kbd style={{ padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px', fontSize: '11px' }}>Esc</kbd> to close</span>
            </div>
          </div>
        </div>
      </Overlay>
        </main>
      )}
    </>
  );
}

export default App;

