import { useState, useEffect } from 'react';
import { api } from '../services/api';

export type FocusMode = 'focus1' | 'focus15' | 'focus25' | 'deepwork60' | 'clearinbox10' | 'prepformeeting' | 'custom';

export const useFocus = () => {
  const [isActive, setIsActive] = useState(false);
  const [duration, setDuration] = useState(25); // minutes
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Check for active session on mount
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        console.log('[useFocus] Checking for active session on mount...');
        const active = await api.isFocusActive();
        console.log('[useFocus] Active session check:', active);
        
        if (active) {
          const session = await api.getCurrentFocusSession();
          console.log('[useFocus] Found active session:', session);
          
          if (session) {
            setIsActive(true);
            setDuration(session.duration_minutes);
            setRemainingSeconds(session.remaining_seconds);
            console.log('[useFocus] ✓ Restored active session state');
          }
        }
      } catch (error) {
        console.error('[useFocus] Error checking active session:', error);
      }
    };

    checkActiveSession();
  }, []); // Run once on mount

  // Poll for remaining time and check for active sessions
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const active = await api.isFocusActive();
        
        if (active) {
          // Session is active - update state if not already set
          if (!isActive) {
            console.log('[useFocus] Detected active session, updating state...');
            const session = await api.getCurrentFocusSession();
            if (session) {
              setIsActive(true);
              setDuration(session.duration_minutes);
              setRemainingSeconds(session.remaining_seconds);
            }
          } else {
            // Update remaining seconds
            const remaining = await api.getFocusRemainingSeconds();
            setRemainingSeconds(remaining);
            
            // Immediately hide UI if timer reaches 0 or less
            if (remaining !== null && remaining <= 0) {
              console.log('[useFocus] Timer reached 0, immediately hiding UI...');
              setIsActive(false);
              setRemainingSeconds(null);
            }
          }
        } else {
          // Session is not active - clear state if it was set
          if (isActive) {
            console.log('[useFocus] Session ended, clearing state...');
            setIsActive(false);
            setRemainingSeconds(null);
          }
        }
      } catch (error) {
        console.error('Error checking focus status:', error);
      }
    }, 100); // Update every 100ms for more responsive UI

    return () => clearInterval(interval);
  }, [isActive]);
  
  // Additional immediate check when remainingSeconds changes to 0 or less
  useEffect(() => {
    if (isActive && remainingSeconds !== null && remainingSeconds <= 0) {
      console.log('[useFocus] Timer reached 0, immediately hiding UI...');
      setIsActive(false);
      setRemainingSeconds(null);
    }
  }, [remainingSeconds, isActive]);

  const startFocus = async (mode: FocusMode, customMinutes?: number) => {
    try {
      console.log('[useFocus] Calling api.startFocusMode with:', { mode, customMinutes });
      const session = await api.startFocusMode(mode, customMinutes);
      console.log('[useFocus] ✓ Received session:', session);
      setIsActive(true);
      setDuration(session.duration_minutes);
      setRemainingSeconds(session.remaining_seconds);
    } catch (error) {
      console.error('[useFocus] ✗ Failed to start focus mode:', error);
      console.error('[useFocus] Error type:', typeof error);
      console.error('[useFocus] Error details:', error);
      throw error;
    }
  };

  const stopFocus = async () => {
    try {
      await api.stopFocusMode();
      setIsActive(false);
      setRemainingSeconds(null);
    } catch (error) {
      console.error('Failed to stop focus mode:', error);
      throw error;
    }
  };

  return { 
    isActive, 
    duration, 
    remainingSeconds,
    startFocus, 
    stopFocus 
  };
};

