import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore, type User } from '../../stores/authStore';
import { authService } from '../../services/auth';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const Login: React.FC = () => {
  const { login, setLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'token'>('email');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null);
  const [showMagicLinkModal, setShowMagicLinkModal] = useState(false);
  const [showMagicLinkEmbedded, setShowMagicLinkEmbedded] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const callbackServerPromiseRef = useRef<Promise<void> | null>(null);
  const previousModalStateRef = useRef<boolean>(false);

  useEffect(() => {
    // Focus email input on mount
    if (step === 'email' && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [step]);

  useEffect(() => {
    // Debug: Log when magicLinkUrl changes
    if (magicLinkSent) {
      console.log('[Login] magicLinkSent:', magicLinkSent, 'magicLinkUrl:', magicLinkUrl);
    }
  }, [magicLinkSent, magicLinkUrl]);

  // Set up listener for magic link callback via postMessage (fallback method)
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      console.log('[Login] postMessage received:', {
        type: event.data?.type,
        hasToken: !!event.data?.token,
        origin: event.origin
      });
      
      // Accept from any origin for magic link callbacks
      if (event.data && (event.data.type === 'MAGIC_LINK_CALLBACK' || event.data.type === 'AUTH_SUCCESS')) {
        const { token, email: callbackEmail, user: userData } = event.data;
        console.log('[Login] ========================================');
        console.log('[Login] ✓✓✓ POSTMESSAGE CALLBACK RECEIVED ✓✓✓');
        console.log('[Login] ========================================');
        console.log('[Login] Type:', event.data.type);
        console.log('[Login] Has token:', !!token);
        console.log('[Login] Email:', callbackEmail);
        console.log('[Login] Origin:', event.origin);
        
        if (token) {
          try {
            console.log('[Login] Processing callback token from postMessage...');
            
            // If we have user data from postMessage, use it; otherwise fetch it
            let user;
            if (userData && userData.id) {
              console.log('[Login] Using user data from postMessage');
              user = userData;
            } else {
              console.log('[Login] Fetching user data from server...');
              user = await authService.getCurrentUser(token);
            }
            
            console.log('[Login] User retrieved:', user);
            
            const { login: loginFn } = useAuthStore.getState();
            console.log('[Login] Calling login function with token...');
            loginFn(user, token);
            
            // Also set directly as backup
            const store = useAuthStore.getState();
            store.setUser(user);
            store.setToken(token);
            
            // Wait for state to persist
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verify login worked
            const authState = useAuthStore.getState();
            console.log('[Login] ===== POSTMESSAGE AUTH STATE CHECK =====');
            console.log('[Login] Auth state after postMessage login:', {
              isAuthenticated: authState.isAuthenticated,
              hasUser: !!authState.user,
              hasToken: !!authState.token,
              userEmail: authState.user?.email
            });
            
            // Check localStorage
            const storedAuth = localStorage.getItem('auth-storage');
            console.log('[Login] localStorage after postMessage:', !!storedAuth);
            
            if (authState.isAuthenticated && authState.user && authState.token) {
              console.log('[Login] ✓✓✓ LOGIN SUCCESSFUL VIA POSTMESSAGE ✓✓✓');
              console.log('[Login] Reloading app in 1 second...');
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            } else {
              console.error('[Login] ✗✗✗ LOGIN STATE NOT PROPERLY SET AFTER POSTMESSAGE ✗✗✗');
              console.error('[Login] Details:', {
                isAuthenticated: authState.isAuthenticated,
                hasUser: !!authState.user,
                hasToken: !!authState.token
              });
            }
          } catch (err) {
            console.error('[Login] ✗✗✗ POSTMESSAGE HANDLER ERROR ✗✗✗');
            console.error('[Login] Error:', err);
          }
        } else {
          console.warn('[Login] postMessage received but no token in data');
        }
      }
    };
    
    window.addEventListener('message', handler);
    console.log('[Login] ✓ Global message listener set up for MAGIC_LINK_CALLBACK and AUTH_SUCCESS');
    
    return () => {
      window.removeEventListener('message', handler);
    };
  }, []); // Run once on mount

  // Poll auth state periodically when waiting for callback
  useEffect(() => {
    if (!magicLinkSent) return;
    
    const pollInterval = setInterval(() => {
      const { isAuthenticated, user, token } = useAuthStore.getState();
      if (isAuthenticated && user && token) {
        console.log('[Login] Auth state check: User is authenticated, reloading...');
        clearInterval(pollInterval);
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        console.log('[Login] Polling auth state - not authenticated yet');
      }
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(pollInterval);
  }, [magicLinkSent]);

  // Handle modal close - extract token and auto-login if available
  useEffect(() => {
    // Check if modal just closed (was open, now closed)
    const wasOpen = previousModalStateRef.current;
    const isNowClosed = !showMagicLinkEmbedded;
    
    // Update previous state
    previousModalStateRef.current = showMagicLinkEmbedded;

    // Only proceed if modal was open and is now closed
    if (!wasOpen || !isNowClosed) return;

    console.log('[Login] Modal closed, checking for token in iframe...');

    // Extract token from iframe when modal closes
    const extractTokenAndLogin = async () => {
      if (!iframeRef.current) {
        console.log('[Login] No iframe reference available');
        return;
      }

      try {
        const iframe = iframeRef.current;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

        if (iframeDoc) {
          // Check if we're on the success page
          const tokenElement = iframeDoc.getElementById('token');
          const successHeading = iframeDoc.querySelector('h1');

          if (tokenElement && successHeading?.textContent?.includes('successful')) {
            const token = tokenElement.textContent?.trim();

            if (token) {
              console.log('[Login] Token found in iframe when modal closed, logging in...');

              // Extract user email from the page
              const userInfoSection = iframeDoc.querySelector('.user-info');
              let userEmail = email;
              if (userInfoSection) {
                const emailElement = Array.from(userInfoSection.querySelectorAll('p')).find(
                  (p) => p.textContent?.startsWith('Email:')
                );
                if (emailElement) {
                  userEmail = emailElement.textContent.replace('Email:', '').trim();
                }
              }

              // Check if already authenticated to avoid duplicate login
              const currentAuthState = useAuthStore.getState();
              if (currentAuthState.isAuthenticated && currentAuthState.user) {
                console.log('[Login] User already logged in, skipping duplicate login');
                return;
              }

              // Verify token and log in
              try {
                setLoading(true);
                const response = await authService.verifyToken(token, userEmail);
                if (response.success && response.user && response.token) {
                  console.log('[Login] Token verified, logging in user...');
                  login(response.user, response.token);
                  setSuccess('Login successful! Redirecting...');
                  setLoading(false);

                  // Reload to apply authentication
                  setTimeout(() => {
                    window.location.reload();
                  }, 1000);
                } else {
                  setLoading(false);
                }
              } catch (error: any) {
                console.error('[Login] Failed to verify token on modal close:', error);
                setLoading(false);
              }
            } else {
              console.log('[Login] No token found in iframe element');
            }
          } else {
            console.log('[Login] Success page not detected in iframe');
          }
        } else {
          console.log('[Login] Cannot access iframe document');
        }
      } catch (error) {
        // Cross-origin error is expected, ignore it
        console.log('[Login] Cannot access iframe content when modal closed (cross-origin):', error);
      }
    };

    // Small delay to ensure iframe content is accessible
    const timeout = setTimeout(extractTokenAndLogin, 100);

    return () => {
      clearTimeout(timeout);
    };
  }, [showMagicLinkEmbedded, email, login]);

  // Listen for authentication success from iframe and auto-close after 5 seconds
  useEffect(() => {
    if (!showMagicLinkEmbedded || !magicLinkUrl) return;

    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;
    let messageHandler: ((event: MessageEvent) => void) | null = null;
    let authenticationHandled = false;

    const handleAuthentication = async (token: string, user: any) => {
      if (authenticationHandled) return;
      authenticationHandled = true;

      console.log('[Login] Handling authentication with token and user:', { token, user });
      
      try {
        setLoading(true);
        
        // If we have a full user object from postMessage, use it
        // Otherwise, verify the token with the server to get user info
        let userData: User;
        
        if (user && (user.id || user._id || user.email)) {
          // Full user object from postMessage
          console.log('[Login] Using user object from postMessage:', user);
          userData = {
            id: user.id || user._id?.toString() || '',
            email: user.email || email,
            name: user.name || user.email?.split('@')[0] || 'User',
            subscriptionStatus: user.subscriptionStatus || 'free',
          };
          console.log('[Login] Processed userData:', userData);
        } else {
          // Only have token, need to verify with server
          console.log('[Login] Verifying token with server to get user info...');
          const response = await authService.verifyToken(token, email);
          
          if (response.success && response.user && response.token) {
            userData = response.user;
            // Use the token from response (might be refreshed)
            const finalToken = response.token;
            console.log('[Login] Token verified, logging in with:', userData);
            login(userData, finalToken);
            setSuccess('Login successful! Redirecting...');
            setShowMagicLinkEmbedded(false);
            setLoading(false);
            
            // Clear any timeouts
            if (timeoutId) clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
            
            // Redirect will be handled by App.tsx
            setTimeout(() => {
              window.location.reload();
            }, 1000);
            return;
          } else {
            throw new Error('Token verification failed');
          }
        }

        console.log('[Login] Logging in with:', userData);
        login(userData, token);
        
        // Verify the state was set correctly
        const authState = useAuthStore.getState();
        console.log('[Login] Auth state after login:', {
          user: authState.user,
          token: authState.token ? 'Token set' : 'Token missing',
          isAuthenticated: authState.isAuthenticated
        });
        
        setSuccess('Login successful! Redirecting...');
        setShowMagicLinkEmbedded(false);
        setLoading(false);
        
        // Clear any timeouts
        if (timeoutId) clearTimeout(timeoutId);
        if (intervalId) clearInterval(intervalId);
        
        // Wait a bit longer to ensure state is persisted to localStorage
        setTimeout(() => {
          // Double-check state before reload
          const finalState = useAuthStore.getState();
          console.log('[Login] Final auth state before reload:', {
            user: finalState.user,
            isAuthenticated: finalState.isAuthenticated,
            token: finalState.token ? 'Token exists' : 'Token missing'
          });
          
          // Also check localStorage directly
          const storedAuth = localStorage.getItem('auth-storage');
          console.log('[Login] Stored auth in localStorage:', storedAuth ? 'Exists' : 'Missing');
          
          if (finalState.isAuthenticated && finalState.user && finalState.token) {
            console.log('[Login] ✓ State verified, reloading...');
            window.location.reload();
          } else {
            console.error('[Login] ✗ State not properly set, not reloading');
            setError('Login state not saved. Please try again.');
            authenticationHandled = false; // Allow retry
          }
        }, 1500);
      } catch (error: any) {
        console.error('[Login] Failed to login with token from iframe:', error);
        setError(error.message || 'Failed to complete login. Please try again.');
        setLoading(false);
        authenticationHandled = false;
      }
    };

    // Listen for postMessage from iframe
    messageHandler = (event: MessageEvent) => {
      console.log('[Login] Received message event:', { origin: event.origin, data: event.data });
      
      // Accept messages from any origin if they have the correct type
      // The server sends with '*' origin, so we need to be permissive
      if (event.data && event.data.type === 'AUTH_SUCCESS') {
        console.log('[Login] Authentication success received from iframe:', event.data);
        const { token, user } = event.data;
        
        if (token) {
          console.log('[Login] Token received:', token.substring(0, 20) + '...');
          console.log('[Login] User received:', user);
          handleAuthentication(token, user || {});
        } else {
          console.error('[Login] No token in AUTH_SUCCESS message');
        }
      } else {
        console.log('[Login] Message ignored - not AUTH_SUCCESS type');
      }
    };

    // Set up message listener immediately (before iframe loads)
    window.addEventListener('message', messageHandler);
    console.log('[Login] Message listener set up, waiting for AUTH_SUCCESS message...');

    // Also poll the iframe content to extract token if postMessage doesn't work
    const pollIframeForToken = async () => {
      if (!iframeRef.current || authenticationHandled) return;
      
      try {
        const iframe = iframeRef.current;
        
        // First, try to get token from URL if it's in query params
        try {
          const iframeUrl = iframe.contentWindow?.location.href;
          if (iframeUrl) {
            const url = new URL(iframeUrl);
            const tokenParam = url.searchParams.get('token');
            if (tokenParam) {
              console.log('[Login] Token found in iframe URL, verifying with server...');
              const response = await authService.verifyToken(tokenParam, email);
              if (response.success && response.user && response.token) {
                console.log('[Login] Token from URL verified, user info:', response.user);
                handleAuthentication(response.token, response.user);
                return;
              }
            }
          }
        } catch (urlError) {
          // Can't access iframe URL due to cross-origin, that's expected
          console.log('[Login] Cannot access iframe URL (cross-origin), trying DOM extraction...');
        }
        
        // Fallback: try to access iframe DOM
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        
        if (iframeDoc) {
          // Check if we're on the success page
          const tokenElement = iframeDoc.getElementById('token');
          const successHeading = iframeDoc.querySelector('h1');
          
          if (tokenElement && successHeading?.textContent?.includes('successful')) {
            const token = tokenElement.textContent?.trim();
            
            // Try to extract user info from the page
            const userInfoSection = iframeDoc.querySelector('.user-info');
            let userEmail = email;
            if (userInfoSection) {
              const emailElement = Array.from(userInfoSection.querySelectorAll('p')).find(
                (p) => p.textContent?.startsWith('Email:')
              );
              if (emailElement) {
                userEmail = emailElement.textContent.replace('Email:', '').trim();
              }
            }
            
            if (token) {
              console.log('[Login] Token extracted from iframe DOM, verifying with server...');
              // Verify token with server to get full user info
              try {
                const response = await authService.verifyToken(token, userEmail);
                if (response.success && response.user && response.token) {
                  console.log('[Login] Token verified, user info:', response.user);
                  handleAuthentication(response.token, response.user);
                } else {
                  console.error('[Login] Token verification failed');
                }
              } catch (error) {
                console.error('[Login] Error verifying token:', error);
                // Fallback: try to use token anyway
                const userData = {
                  id: '',
                  email: userEmail,
                  name: userEmail.split('@')[0],
                  subscriptionStatus: 'free' as const,
                };
                handleAuthentication(token, userData);
              }
            }
          }
        }
      } catch (error) {
        // Cross-origin error is expected, ignore it
        // console.log('[Login] Cannot access iframe content (cross-origin):', error);
      }
    };

    // Poll every 500ms to check for token in iframe
    intervalId = setInterval(pollIframeForToken, 500);

    // Auto-close after 5 seconds if no authentication message received
    // But only if authentication hasn't been handled
    timeoutId = setTimeout(() => {
      if (!authenticationHandled) {
        console.log('[Login] Auto-closing magic link modal after 5 seconds (no authentication received)');
        setShowMagicLinkEmbedded(false);
        // Don't close if we're still processing
        console.log('[Login] Note: If authentication is in progress, user will need to manually enter token');
      } else {
        console.log('[Login] Authentication already handled, not auto-closing');
      }
    }, 5000);

    return () => {
      if (messageHandler) {
        window.removeEventListener('message', messageHandler);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [showMagicLinkEmbedded, magicLinkUrl, login, email]);

  // Email validation function
  const validateEmail = (email: string): boolean => {
    // RFC 5322 compliant email regex (simplified but comprehensive)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Trim email and validate
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) {
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address (e.g., user@example.com)');
      return;
    }

    // Update email state with trimmed value
    setEmail(trimmedEmail);

    try {
      setLoading(true);
      
      // Start the callback server to listen for magic link verification
      console.log('[Login] Starting magic link callback server...');
      
      // Start callback server - the promise will resolve when callback is received
      console.log('[Login] About to call invoke("start_magic_link_callback_server")...');
      const callbackServerPromise = invoke<[string, string]>('start_magic_link_callback_server', { port: 8081 })
        .then(async (result) => {
          console.log('[Login] ========================================');
          console.log('[Login] ✓✓✓ PROMISE .then() HANDLER EXECUTED ✓✓✓');
          console.log('[Login] ========================================');
          console.log('[Login] ========================================');
          console.log('[Login] ✓✓✓ CALLBACK SERVER RECEIVED RESPONSE ✓✓✓');
          console.log('[Login] ========================================');
          console.log('[Login] Result type:', typeof result);
          console.log('[Login] Result is array:', Array.isArray(result));
          console.log('[Login] Result:', result);
          
          if (!result || !Array.isArray(result) || result.length < 2) {
            console.error('[Login] Invalid result format:', result);
            throw new Error('Invalid callback response format');
          }
          
          const [jwtToken, userEmail] = result;
          console.log('[Login] Extracted token length:', jwtToken?.length || 0, 'Email:', userEmail);
          
          if (!jwtToken || !userEmail) {
            console.error('[Login] Missing token or email in response');
            throw new Error('Invalid callback response: missing token or email');
          }
          
          console.log('[Login] Magic link callback received! Token length:', jwtToken.length, 'Email:', userEmail);
          
          // Use the JWT token directly to get user info
          try {
            // Get user info using the JWT token
            console.log('[Login] Fetching user info with JWT token...');
            const user = await authService.getCurrentUser(jwtToken);
            console.log('[Login] User info retrieved:', user);
            
            if (!user || !user.id) {
              throw new Error('Failed to get user info from server');
            }
            
            // Log the user in with the JWT token and user info
            console.log('[Login] ===== CALLING LOGIN FUNCTION =====');
            console.log('[Login] User data:', { id: user.id, email: user.email, name: user.name });
            console.log('[Login] Token (first 20 chars):', jwtToken.substring(0, 20));
            
            // Get the store instance
            const store = useAuthStore.getState();
            console.log('[Login] Store instance obtained');
            
            // Call login function - IMPORTANT: use the login from useAuthStore hook
            console.log('[Login] Calling login function...');
            login(user, jwtToken);
            console.log('[Login] Login function called');
            
            // Also directly set the state as a backup
            console.log('[Login] Directly setting store state as backup...');
            store.setUser(user);
            store.setToken(jwtToken);
            console.log('[Login] Direct state set complete');
            
            // Wait a moment for state to update and persist
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verify login state was set
            const authState = useAuthStore.getState();
            console.log('[Login] ===== AUTH STATE CHECK =====');
            console.log('[Login] Auth state after login:', {
              user: authState.user ? { id: authState.user.id, email: authState.user.email } : null,
              isAuthenticated: authState.isAuthenticated,
              hasToken: !!authState.token,
              tokenLength: authState.token?.length || 0
            });
            
            // Also check localStorage directly
            const storedAuth = localStorage.getItem('auth-storage');
            console.log('[Login] localStorage auth-storage exists:', !!storedAuth);
            if (storedAuth) {
              try {
                const parsed = JSON.parse(storedAuth);
                console.log('[Login] localStorage state:', {
                  hasUser: !!parsed.state?.user,
                  isAuthenticated: parsed.state?.isAuthenticated,
                  hasToken: !!parsed.state?.token,
                  userEmail: parsed.state?.user?.email
                });
              } catch (e) {
                console.error('[Login] Failed to parse localStorage:', e);
              }
            }
            
            if (!authState.isAuthenticated || !authState.user || !authState.token) {
              console.error('[Login] ✗✗✗ LOGIN STATE NOT PROPERLY SET ✗✗✗');
              console.error('[Login] State details:', {
                isAuthenticated: authState.isAuthenticated,
                hasUser: !!authState.user,
                hasToken: !!authState.token,
                user: authState.user,
                token: authState.token ? 'EXISTS' : 'MISSING'
              });
              
              // Try to set it again
              console.log('[Login] Attempting to set login state again...');
              login(user, jwtToken);
              await new Promise(resolve => setTimeout(resolve, 200));
              
              const retryState = useAuthStore.getState();
              if (!retryState.isAuthenticated || !retryState.user || !retryState.token) {
                throw new Error('Login state not properly set even after retry');
              } else {
                console.log('[Login] ✓ Login state set successfully on retry');
              }
            } else {
              console.log('[Login] ✓✓✓ LOGIN STATE VERIFIED SUCCESSFULLY ✓✓✓');
            }
            
            console.log('[Login] ✓ Login state verified, setting success message...');
            setSuccess('Login successful! Redirecting...');
            setLoading(false);
            
            // Small delay to ensure state is persisted, then reload
            setTimeout(() => {
              console.log('[Login] ===== RELOADING APP =====');
              // Force reload to ensure state is read from localStorage
              window.location.reload();
            }, 1000);
          } catch (verifyErr: any) {
            console.error('[Login] ✗✗✗ FAILED TO COMPLETE LOGIN ✗✗✗');
            console.error('[Login] Error:', verifyErr);
            console.error('[Login] Error message:', verifyErr.message);
            console.error('[Login] Error stack:', verifyErr.stack);
            setError(`Failed to complete login: ${verifyErr.message || 'Unknown error'}`);
            setLoading(false);
          }
        })
        .catch((err: any) => {
          console.error('[Login] ========================================');
          console.error('[Login] ✗✗✗ PROMISE .catch() HANDLER EXECUTED ✗✗✗');
          console.error('[Login] ========================================');
          const errorMsg = err?.toString() || String(err);
          console.error('[Login] Error object:', err);
          console.error('[Login] Error message:', errorMsg);
          console.error('[Login] Error type:', typeof err);
          if (err?.message) {
            console.error('[Login] Error.message:', err.message);
          }
          if (err?.stack) {
            console.error('[Login] Error.stack:', err.stack);
          }
          
          // Don't show error if it's just a timeout - user might still use manual token entry
          if (!errorMsg.includes('timeout') && !errorMsg.includes('5 minutes')) {
            console.warn('[Login] Callback server failed:', errorMsg);
            // Only show error if it's not a timeout
            if (!errorMsg.includes('timeout')) {
              // If port is busy, suggest closing other instances
              if (errorMsg.includes('8081') || errorMsg.includes('already in use')) {
                setError('Port 8081 is busy. Please close other app instances and try again. You can also use manual token entry.');
              } else {
                setError('Callback server error. You can still use manual token entry.');
              }
            }
          }
          setLoading(false);
        });
      
      console.log('[Login] Callback server promise created, waiting for callback...');
      console.log('[Login] Promise state:', callbackServerPromise);
      
      // Add a timeout check to see if promise is still pending
      setTimeout(() => {
        console.log('[Login] [TIMEOUT CHECK] 10 seconds passed - checking promise state...');
        // We can't directly check promise state, but we can log that time has passed
      }, 10000);
      
      // Also set up a global listener to handle callback even if component unmounts
      // This ensures we don't lose the callback
      const globalCallbackHandler = async (event: MessageEvent) => {
        // Check if this is a callback from the magic link server
        if (event.data && event.data.type === 'MAGIC_LINK_CALLBACK') {
          const { token, email: callbackEmail } = event.data;
          if (token && callbackEmail === email) {
            console.log('[Login] Received magic link callback via postMessage');
            try {
              const user = await authService.getCurrentUser(token);
              login(user, token);
              setSuccess('Login successful! Redirecting...');
              setLoading(false);
              setTimeout(() => window.location.reload(), 500);
            } catch (err) {
              console.error('[Login] Failed to handle callback:', err);
            }
          }
        }
      };
      
      // Listen for postMessage as fallback
      window.addEventListener('message', globalCallbackHandler);
      
      // Also set up a listener that persists even after component unmounts
      // Store handler in a way that persists
      (window as any).__magicLinkCallbackHandler = globalCallbackHandler;

      // Request magic link from server
      const response = await authService.requestMagicLink(email);
      
      if (response.success) {
        setMagicLinkSent(true);
        setSuccess('Magic link sent! Check your email. The app will automatically log you in when you click the link.');
        
        // Get magic link URL from response and add desktop_app parameter
        let magicLink = response.magicLinkUrl;
        if (!magicLink && response.token) {
          const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
          magicLink = `${baseUrl}/api/auth/verify?token=${response.token}&email=${encodeURIComponent(email)}`;
        }
        
        // Add desktop_app=true parameter to trigger redirect to localhost
        if (magicLink) {
          const url = new URL(magicLink);
          url.searchParams.set('desktop_app', 'true');
          magicLink = url.toString();
          setMagicLinkUrl(magicLink);
          setShowMagicLinkModal(true);
          console.log('[Login] Magic link URL set (with desktop_app):', magicLink);
        }
        
        console.log('[Login] Magic link sent to:', email);
        console.log('[Login] Waiting for callback server...');
        console.log('[Login] Callback server is listening on http://localhost:8081/auth/callback');
        console.log('[Login] When you click the magic link, it will automatically log you in.');
        
        // Store promise in ref - the actual login is handled in the main promise chain above
        // This ref is just for tracking, the login happens in the .then() handler of callbackServerPromise
        callbackServerPromiseRef.current = callbackServerPromise.then(() => {
          console.log('[Login] ✓✓✓ MAIN PROMISE RESOLVED - Login should have completed ✓✓✓');
          // Double-check that login actually happened
          const finalState = useAuthStore.getState();
          if (finalState.isAuthenticated && finalState.user && finalState.token) {
            console.log('[Login] ✓ Confirmed: User is logged in via main promise');
          } else {
            console.error('[Login] ✗ ERROR: Main promise resolved but user is NOT logged in!');
            console.error('[Login] State:', {
              isAuthenticated: finalState.isAuthenticated,
              hasUser: !!finalState.user,
              hasToken: !!finalState.token
            });
          }
        }).catch((err) => {
          // Error already handled above, just log it
          console.error('[Login] Main promise rejected:', err);
        }) as Promise<void>;
        
        // Wait for callback (non-blocking - user can still use manual token entry)
        // The promise will resolve when the callback is received
        if (callbackServerPromiseRef.current) {
          callbackServerPromiseRef.current.catch(() => {
            // Already handled in promise chain
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link. Please try again.');
      setLoading(false);
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token.trim()) {
      setError('Please enter the token from the magic link');
      return;
    }

    try {
      setLoading(true);
      const response = await authService.verifyToken(token.trim(), email);
      
      if (response.success && response.user && response.token) {
        // Login successful
        login(response.user, response.token);
        setSuccess('Login successful! Redirecting...');
        
        // Redirect will be handled by App.tsx
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid token. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMagicLink = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (magicLinkUrl) {
      // Show embedded iframe modal inside the app
      setShowMagicLinkEmbedded(true);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setToken('');
    setError(null);
    setSuccess(null);
    setMagicLinkSent(false);
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 100);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px 20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        <h1 style={{
          margin: '0 0 10px 0',
          fontSize: '28px',
          fontWeight: '700',
          color: '#1a1a1a',
          textAlign: 'center',
        }}>
          LetMeSell
        </h1>
        <p style={{
          margin: '0 0 30px 0',
          fontSize: '14px',
          color: '#666',
          textAlign: 'center',
        }}>
          Sign in to continue
        </p>

        {error && (
          <div style={{
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            color: '#c33',
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#efe',
            border: '1px solid #cfc',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            color: '#3c3',
            fontSize: '14px',
          }}>
            {success}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#333',
              }}>
                Email Address
              </label>
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmail(value);
                  // Clear error when user starts typing
                  if (error) setError(null);
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#ddd';
                  // Validate on blur
                  const trimmedEmail = e.target.value.trim();
                  if (trimmedEmail && !validateEmail(trimmedEmail)) {
                    setError('Please enter a valid email address');
                  }
                }}
                placeholder="your@email.com"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
              />
            </div>

            <button
              type="submit"
              disabled={!email.trim() || !validateEmail(email.trim())}
              style={{
                width: '100%',
                padding: '14px',
                background: email.trim() && validateEmail(email.trim()) ? '#667eea' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: email.trim() && validateEmail(email.trim()) ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (email.trim() && validateEmail(email.trim())) {
                  e.currentTarget.style.background = '#5568d3';
                }
              }}
              onMouseLeave={(e) => {
                if (email.trim() && validateEmail(email.trim())) {
                  e.currentTarget.style.background = '#667eea';
                }
              }}
            >
              Send Magic Link
            </button>

            {magicLinkSent && (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
              }}>
                <p style={{
                  fontSize: '12px',
                  color: '#0369a1',
                  marginBottom: '12px',
                  fontWeight: '600',
                }}>
                  Magic Link (Click to open):
                </p>
                {magicLinkUrl ? (
                  <a
                    href={magicLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleOpenMagicLink}
                    style={{
                      display: 'block',
                      wordBreak: 'break-all',
                      fontSize: '12px',
                      color: '#0284c7',
                      textDecoration: 'underline',
                      marginBottom: '16px',
                      padding: '14px',
                      background: 'white',
                      borderRadius: '4px',
                      border: '2px solid #0284c7',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'monospace',
                      fontWeight: '500',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e0f2fe';
                      e.currentTarget.style.borderColor = '#0369a1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.borderColor = '#0284c7';
                    }}
                  >
                    {magicLinkUrl}
                  </a>
                ) : (
                  <div style={{
                    padding: '14px',
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '4px',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: '#856404',
                  }}>
                    Generating magic link...
                  </div>
                )}
                <p style={{
                  fontSize: '11px',
                  color: '#0369a1',
                  marginBottom: '12px',
                }}>
                  Check your email for the magic link. The link will also appear in the server console.
                </p>
                <p style={{
                  fontSize: '11px',
                  color: '#0369a1',
                  marginBottom: '12px',
                }}>
                  After clicking the link, copy the token from the page and paste it below.
                </p>
                {magicLinkUrl && (
                  <button
                    type="button"
                    onClick={handleOpenMagicLink}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: '#0284c7',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginBottom: '12px',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#0369a1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#0284c7';
                    }}
                  >
                    🔗 Open Magic Link in Browser
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep('token')}
                  style={{
                    marginTop: '12px',
                    width: '100%',
                    padding: '10px',
                    background: '#0284c7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Continue to Token Entry
                </button>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={handleTokenSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#333',
              }}>
                Enter Token from Magic Link
              </label>
              <input
                ref={tokenInputRef}
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token here..."
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#ddd'}
              />
              <p style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#666',
              }}>
                After clicking the magic link in your email, copy the token from the page and paste it here.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleBackToEmail}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#f5f5f5',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!token.trim()}
                style={{
                  flex: 2,
                  padding: '14px',
                  background: token.trim() ? '#667eea' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: token.trim() ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (token.trim()) {
                    e.currentTarget.style.background = '#5568d3';
                  }
                }}
                onMouseLeave={(e) => {
                  if (token.trim()) {
                    e.currentTarget.style.background = '#667eea';
                  }
                }}
              >
                Sign In
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Magic Link Modal */}
      {showMagicLinkModal && magicLinkUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowMagicLinkModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: '700',
                color: '#1a1a1a',
              }}>
                Magic Link Ready!
              </h2>
              <button
                onClick={() => setShowMagicLinkModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                ×
              </button>
            </div>

            <p style={{
              marginBottom: '20px',
              fontSize: '14px',
              color: '#666',
            }}>
              Click the link below to open it in your browser, then copy the token from the page.
            </p>

            <div style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
            }}>
              <div style={{
                fontSize: '12px',
                color: '#0369a1',
                marginBottom: '12px',
                fontWeight: '600',
              }}>
                Magic Link (Click to open):
              </div>
              {magicLinkUrl ? (
                <a
                  href={magicLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleOpenMagicLink}
                  style={{
                    display: 'block',
                    wordBreak: 'break-all',
                    fontSize: '12px',
                    color: '#0284c7',
                    textDecoration: 'underline',
                    marginBottom: '16px',
                    padding: '14px',
                    background: 'white',
                    borderRadius: '4px',
                    border: '2px solid #0284c7',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'monospace',
                    fontWeight: '500',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e0f2fe';
                    e.currentTarget.style.borderColor = '#0369a1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#0284c7';
                  }}
                >
                  {magicLinkUrl}
                </a>
              ) : (
                <div style={{
                  padding: '14px',
                  background: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '4px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#856404',
                }}>
                  Magic link is being generated...
                </div>
              )}
              <p style={{
                fontSize: '11px',
                color: '#0369a1',
                marginBottom: '12px',
              }}>
                Check your email for the magic link. The link will also appear in the server console.
              </p>
              <p style={{
                fontSize: '11px',
                color: '#0369a1',
                marginBottom: '12px',
              }}>
                After clicking the link, copy the token from the page and paste it below.
              </p>
              <button
                onClick={handleOpenMagicLink}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#0284c7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#0369a1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#0284c7';
                }}
              >
                🔗 Open Magic Link in Browser
              </button>
            </div>

            <div style={{
              display: 'flex',
              gap: '10px',
            }}>
              <button
                onClick={() => {
                  setShowMagicLinkModal(false);
                  setStep('token');
                  setTimeout(() => {
                    tokenInputRef.current?.focus();
                  }, 100);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f5f5f5',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Continue to Token Entry
              </button>
              <button
                onClick={() => setShowMagicLinkModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Magic Link Modal - Inside the app */}
      {showMagicLinkEmbedded && magicLinkUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
          onClick={() => setShowMagicLinkEmbedded(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '0',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '90vh',
              height: '700px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#1a1a1a',
              }}>
                Magic Link Authentication
              </h2>
              <button
                onClick={() => setShowMagicLinkEmbedded(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                ×
              </button>
            </div>

            {/* Embedded iframe */}
            <iframe
              ref={iframeRef}
              src={magicLinkUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                flex: 1,
              }}
              title="Magic Link Authentication"
              allow="clipboard-read; clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </div>
      )}
    </div>
  );
};

