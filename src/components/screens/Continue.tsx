import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, WindowInfo } from '../../services/api';
import { formatRelativeTime } from '../../utils/timeUtils';
import { getProcessIcon, cleanProcessName, cleanWindowTitle } from '../../utils/windowUtils';
import { useOverlayStore } from '../../stores/overlayStore';
import './../../styles/screens.css';
import './../../styles/design-system.css';

interface ContinueProps {
  onToggleOverlay?: () => void;
}

export const Continue: React.FC<ContinueProps> = ({ onToggleOverlay }) => {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [filteredWindows, setFilteredWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isKeyboardNavActive, setIsKeyboardNavActive] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isOverlayVisible = useOverlayStore((state) => state.isOverlayVisible);
  const [isWindowFocused, setIsWindowFocused] = useState(false);
  const windowFocusedRef = useRef(false); // Synchronous ref for immediate checks
  const lastInteractionRef = useRef<number>(0); // Track last interaction time
  const windowIdRef = useRef<string>(''); // Unique window identifier

  // Load windows data
  const loadWindows = useCallback(async () => {
    try {
      const allWindows = await api.getWindowsInfo().catch(() => []);
      
      // Sort by last_active (most recent first)
      const sorted = allWindows.sort((a, b) => {
        const timeA = new Date(a.last_active).getTime();
        const timeB = new Date(b.last_active).getTime();
        return timeB - timeA;
      });
      
      setWindows(sorted);
      setFilteredWindows(sorted);
    } catch (err) {
      console.error('Error loading windows:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWindows();
    const interval = setInterval(loadWindows, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, [loadWindows]);

  // Get unique window identifier and track focus
  useEffect(() => {
    if (!isOverlayVisible) {
      setIsWindowFocused(false);
      windowFocusedRef.current = false;
      return;
    }

    let appWindow: any = null;

    const setupFocusTracking = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        appWindow = getCurrentWindow();
        
        // Get unique window label/identifier
        const label = appWindow.label || '';
        windowIdRef.current = label;
        
        // Listen to Tauri window focus events
        const unlistenFocus = await appWindow.listen('tauri://focus', () => {
          windowFocusedRef.current = true;
          setIsWindowFocused(true);
          lastInteractionRef.current = Date.now();
        });
        
        const unlistenBlur = await appWindow.listen('tauri://blur', () => {
          windowFocusedRef.current = false;
          setIsWindowFocused(false);
        });
        
        // Initial check
        const isFocused = await appWindow.isFocused();
        windowFocusedRef.current = isFocused;
        setIsWindowFocused(isFocused);
        if (isFocused) {
          lastInteractionRef.current = Date.now();
        }
        
        return () => {
          unlistenFocus();
          unlistenBlur();
        };
      } catch (error) {
        console.error('[Continue] Error setting up focus tracking:', error);
        // Fallback to document focus
        const hasFocus = document.hasFocus();
        windowFocusedRef.current = hasFocus;
        setIsWindowFocused(hasFocus);
        if (hasFocus) {
          lastInteractionRef.current = Date.now();
        }
        return null;
      }
    };

    let unlistenFn: (() => void) | null = null;
    setupFocusTracking().then((unlisten) => {
      unlistenFn = unlisten;
    });

    // Track mouse interactions to mark this window as active
    const handleMouseDown = () => {
      lastInteractionRef.current = Date.now();
      windowFocusedRef.current = true;
      setIsWindowFocused(true);
    };

    // Also check on window focus/blur events as backup
    const handleFocus = () => {
      windowFocusedRef.current = true;
      setIsWindowFocused(true);
      lastInteractionRef.current = Date.now();
    };
    const handleBlur = () => {
      windowFocusedRef.current = false;
      setIsWindowFocused(false);
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('focus', handleFocus, true);
    window.addEventListener('blur', handleBlur, true);

    // Very frequent check to catch focus changes immediately
    const focusInterval = setInterval(async () => {
      if (appWindow) {
        try {
          const isFocused = await appWindow.isFocused();
          if (isFocused !== windowFocusedRef.current) {
            windowFocusedRef.current = isFocused;
            setIsWindowFocused(isFocused);
            if (isFocused) {
              lastInteractionRef.current = Date.now();
            }
          }
        } catch (error) {
          const hasFocus = document.hasFocus();
          if (hasFocus !== windowFocusedRef.current) {
            windowFocusedRef.current = hasFocus;
            setIsWindowFocused(hasFocus);
            if (hasFocus) {
              lastInteractionRef.current = Date.now();
            }
          }
        }
      }
    }, 50); // Check every 50ms

    return () => {
      if (unlistenFn) unlistenFn();
      clearInterval(focusInterval);
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('focus', handleFocus, true);
      window.removeEventListener('blur', handleBlur, true);
    };
  }, [isOverlayVisible]);

  // Filter windows based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredWindows(windows);
      setSelectedIndex(0);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = windows.filter(
      (window) =>
        window.title.toLowerCase().includes(query) ||
        window.process_name.toLowerCase().includes(query) ||
        cleanProcessName(window.process_name).toLowerCase().includes(query)
    );
    
    setFilteredWindows(filtered);
    setSelectedIndex(0);
  }, [searchQuery, windows]);

  // Format time ago
  const getTimeAgo = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const relative = formatRelativeTime(date);
      // Convert "X ago" to "opened X ago"
      if (relative.includes('ago')) {
        return `opened ${relative.replace(' ago', '')} ago`;
      }
      return `opened ${relative}`;
    } catch {
      return 'opened recently';
    }
  };

  // Resume window (bring to front)
  const resumeWindow = useCallback(async (window: WindowInfo) => {
    try {
      // Bring window to front
      await api.bringWindowToFront(window.handle);
      
      // Close overlay - use store to update state AND call backend
      const { setOverlayVisible } = useOverlayStore.getState();
      setOverlayVisible(false);
      await api.hideOverlay();
      
      console.log('[Continue] Window resumed and overlay closed');
    } catch (err) {
      console.error('Error resuming window:', err);
      // Still try to close overlay even if bringing window to front failed
      try {
        const { setOverlayVisible } = useOverlayStore.getState();
        setOverlayVisible(false);
        await api.hideOverlay();
      } catch (closeErr) {
        console.error('Error closing overlay:', closeErr);
      }
    }
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOverlayVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // CRITICAL: Always allow backspace/delete FIRST - never block them
      // This must be checked before anything else
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // Always allow backspace/delete - don't block, don't prevent default
        // Return immediately to let the input handle it
        return; // Don't prevent default - let it work normally
      }
      
      const isSearchFocused = document.activeElement === searchInputRef.current;
      
      // CRITICAL: If search input is focused, let ALL other keys work normally
      // Don't interfere with normal input editing - return immediately for non-navigation keys
      if (isSearchFocused) {
        // Only handle special navigation keys, let everything else work normally
        // This ensures typing and all editing works
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Escape' || e.key === 'Enter') {
          // Handle these special keys below - continue to the rest of the function
        } else {
          // For all other keys (typing, etc.), let them work normally
          // Return immediately without any checks - don't prevent default
          return; // Don't prevent default - let the input handle it
        }
      }
      
      // For non-search keys or when search is not focused, check window focus
      const hasDocFocus = document.hasFocus();
      const hasWindowFocus = windowFocusedRef.current;
      
      if (!hasDocFocus || !hasWindowFocus) {
        // This window doesn't have focus - block keyboard events (except if search is focused)
        if (!isSearchFocused) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return;
        }
      }
      
      // Allow copy/paste operations (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A)
      if (e.ctrlKey || e.metaKey) {
        // Don't block copy/paste operations - let them work normally
        if (['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
          return; // Let the default behavior happen
        }
      }
      
      // Handle Escape - close overlay
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        const { setOverlayVisible } = useOverlayStore.getState();
        setOverlayVisible(false);
        api.hideOverlay().catch(console.error);
        return;
      }

      // Handle arrow keys for navigation (only if search is not focused or it's Up/Down)
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // If search is focused, blur it first
        if (isSearchFocused) {
          searchInputRef.current?.blur();
        }
        e.preventDefault();
        e.stopPropagation();
        setIsKeyboardNavActive(true);
        
        if (e.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredWindows.length - 1));
        } else {
          setSelectedIndex((prev) => (prev < filteredWindows.length - 1 ? prev + 1 : 0));
        }
        return;
      }

      // Don't handle Left/Right arrows - let App.tsx handle screen navigation
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Only prevent if search is focused, otherwise let it bubble up for screen navigation
        if (isSearchFocused) {
          e.preventDefault();
          searchInputRef.current?.blur();
        }
        return; // Let it bubble up to App.tsx for screen switching
      }

      // Handle Enter - resume selected window
      if (e.key === 'Enter' && filteredWindows.length > 0 && !isSearchFocused) {
        e.preventDefault();
        e.stopPropagation();
        const selectedWindow = filteredWindows[selectedIndex];
        if (selectedWindow) {
          resumeWindow(selectedWindow);
        }
        return;
      }

      // Handle typing - focus search input if not already focused
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !isSearchFocused) {
        // Only focus search if it's a printable character
        if (/[a-zA-Z0-9\s\-_\.]/.test(e.key)) {
          searchInputRef.current?.focus();
          // Don't prevent default - let the character be typed
        }
      }
    };

    // Use capture phase to catch events early, but allow backspace to pass through
    // Use capture phase BUT explicitly allow backspace to pass through
    const wrappedHandler = (e: KeyboardEvent) => {
      // CRITICAL: If backspace/delete, don't even call the handler - let it work normally
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // Don't call handleKeyDown at all - let backspace work completely normally
        // Explicitly do NOT prevent default or stop propagation
        console.log('[Continue] Backspace/Delete detected in window handler - bypassing all logic');
        return; // Let it pass through completely
      }
      // For all other keys, call the handler
      handleKeyDown(e);
    };
    
    window.addEventListener('keydown', wrappedHandler, true);
    return () => {
      window.removeEventListener('keydown', wrappedHandler, true);
    };
  }, [isOverlayVisible, filteredWindows, selectedIndex, resumeWindow]);

  // Scroll selected item into view
  useEffect(() => {
    if (isKeyboardNavActive && itemRefs.current[selectedIndex] && listRef.current) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex, isKeyboardNavActive]);

  // Reset selected index when filtered windows change
  useEffect(() => {
    if (selectedIndex >= filteredWindows.length) {
      setSelectedIndex(Math.max(0, filteredWindows.length - 1));
    }
  }, [filteredWindows.length, selectedIndex]);

  // Handle window item click
  const handleWindowClick = (window: WindowInfo) => {
    setIsKeyboardNavActive(false);
    resumeWindow(window);
  };

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // SIMPLIFIED: Just update the state - no blocking logic at all
    // When input is focused, it should work normally (including backspace)
    // Always update - never block or revert
    const newValue = e.target.value;
    setSearchQuery(newValue);
    setIsKeyboardNavActive(false);
    lastInteractionRef.current = Date.now(); // Update interaction time
    
    // Debug log to see if onChange is firing
    if (newValue.length < searchQuery.length) {
      console.log('[Continue] Backspace detected - value changed from', searchQuery, 'to', newValue);
    }
  };

  // Handle search input key events
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // CRITICAL: Always allow editing keys (Backspace, Delete) to work normally
    // Return immediately without any processing
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // Don't prevent default, don't stop propagation - let the input handle it completely
      // Don't do anything - just return and let the browser handle it
      return;
    }
    
    if (e.key === 'ArrowDown' && filteredWindows.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      setIsKeyboardNavActive(true);
      setSelectedIndex(0);
      searchInputRef.current?.blur();
    } else if (e.key === 'ArrowUp' && filteredWindows.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      setIsKeyboardNavActive(true);
      setSelectedIndex(filteredWindows.length - 1);
      searchInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setSearchQuery('');
      const { setOverlayVisible } = useOverlayStore.getState();
      setOverlayVisible(false);
      api.hideOverlay().catch(console.error);
    } else if (e.key === 'Enter' && filteredWindows.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      const selectedWindow = filteredWindows[selectedIndex];
      if (selectedWindow) {
        resumeWindow(selectedWindow);
      }
    }
    // Let Arrow Left/Right bubble up for screen navigation
  };

  return (
    <div className="screen continue-screen">
      {/* Search/Filter Section */}
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">Continue</h3>
        </div>
          <div className="search-container" style={{ marginBottom: 'var(--space-4)' }}>
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search windows..."
            value={searchQuery}
            onChange={handleSearchChange}
            onInput={(e) => {
              // Also handle onInput as a fallback for backspace
              const target = e.target as HTMLInputElement;
              if (target.value !== searchQuery) {
                console.log('[Continue] onInput fired - value changed from', searchQuery, 'to', target.value);
                setSearchQuery(target.value);
                lastInteractionRef.current = Date.now();
              }
            }}
            readOnly={false}
            style={{
              pointerEvents: (!windowFocusedRef.current || !document.hasFocus()) ? 'none' : 'auto',
              opacity: (!windowFocusedRef.current || !document.hasFocus()) ? 0.5 : 1
            }}
            onMouseDown={(e) => {
              // Mark this window as active when user clicks on input
              lastInteractionRef.current = Date.now();
              windowFocusedRef.current = true;
              setIsWindowFocused(true);
            }}
            onKeyDown={(e) => {
              // CRITICAL: Always allow backspace/delete - never block them
              if (e.key === 'Backspace' || e.key === 'Delete') {
                // Always allow backspace/delete - don't block, don't prevent default
                console.log('[Continue] Backspace/Delete pressed in input - allowing it');
                lastInteractionRef.current = Date.now();
                // Don't call handleSearchKeyDown for backspace - let it work normally
                // Explicitly do NOT prevent default or stop propagation
                return; // Let the default behavior happen
              }
              
              // SIMPLIFIED: If input is focused, let all other keys work normally
              const inputIsActive = document.activeElement === searchInputRef.current || 
                                   e.target === searchInputRef.current;
              
              if (inputIsActive) {
                // Input is focused - let all keys work normally, just handle special navigation keys
                lastInteractionRef.current = Date.now();
                handleSearchKeyDown(e);
                return;
              }
              
              // If input is not focused, block keyboard events (multi-monitor protection)
              const timeSinceInteraction = Date.now() - lastInteractionRef.current;
              const hasDocFocus = document.hasFocus();
              const hasWindowFocus = windowFocusedRef.current;
              
              if (!hasDocFocus || !hasWindowFocus || timeSinceInteraction > 200) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return;
              }
              
              lastInteractionRef.current = Date.now();
              handleSearchKeyDown(e);
            }}
            onBeforeInput={(e) => {
              // CRITICAL: Always allow deletion events (backspace/delete) - never block them
              if (e.inputType === 'deleteContentBackward' || 
                  e.inputType === 'deleteContentForward' || 
                  e.inputType === 'deleteWordBackward' || 
                  e.inputType === 'deleteWordForward') {
                // Always allow deletion - never prevent
                lastInteractionRef.current = Date.now();
                return true; // Don't prevent - allow the deletion
              }
              
              // SIMPLIFIED: If input is focused, allow all other input
              const inputIsActive = document.activeElement === searchInputRef.current;
              
              if (inputIsActive) {
                // Input is focused - allow everything (typing, etc.)
                lastInteractionRef.current = Date.now();
                return true; // Don't prevent - allow the input
              }
              
              // If input is not focused, block to prevent multi-monitor typing
              const timeSinceInteraction = Date.now() - lastInteractionRef.current;
              if (!windowFocusedRef.current || !document.hasFocus() || timeSinceInteraction > 200) {
                e.preventDefault();
                return false;
              }
              
              lastInteractionRef.current = Date.now();
              return true;
            }}
            onFocus={async () => {
              // Ensure window has focus when search input is focused
              try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                const appWindow = getCurrentWindow();
                await appWindow.setFocus();
                setIsWindowFocused(true);
              } catch (error) {
                console.error('[Continue] Error setting focus:', error);
              }
            }}
            onBlur={() => {
              // Window might have lost focus
              setIsWindowFocused(false);
            }}
            autoFocus={false}
          />
        </div>
      </div>

      {/* Windows List Section */}
      <div className="section">
        {loading ? (
          <div className="loading-container">
            <div className="loading-text">Loading windows...</div>
          </div>
        ) : filteredWindows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🪟</div>
            <div className="empty-state-title">
              {searchQuery ? 'No windows found' : 'No recent windows'}
            </div>
            <div className="empty-state-description">
              {searchQuery
                ? 'Try a different search term'
                : 'Open some windows to see them here'}
            </div>
          </div>
        ) : (
          <div className="window-list" ref={listRef}>
            {filteredWindows.map((window, index) => {
              const isSelected = isKeyboardNavActive && index === selectedIndex;
              const timeAgo = getTimeAgo(window.last_active);
              
              return (
                <div
                  key={window.handle}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={`window-item continue-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleWindowClick(window)}
                  onMouseEnter={() => {
                    if (!isKeyboardNavActive) {
                      setSelectedIndex(index);
                    }
                  }}
                  tabIndex={-1}
                  role="button"
                  aria-label={`Resume ${window.title} - ${cleanProcessName(window.process_name)}`}
                >
                  <div className="window-item-icon">
                    {getProcessIcon(window.process_name)}
                  </div>
                  <div className="window-item-content">
                    <div className="window-item-title">
                      {cleanWindowTitle(window.title) || '(No Title)'}
                    </div>
                    <div className="window-item-subtitle">
                      {cleanProcessName(window.process_name)}
                    </div>
                  </div>
                  <div className="window-item-meta">
                    <span className="window-item-time">{timeAgo}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
