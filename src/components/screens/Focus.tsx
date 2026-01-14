import React, { useState, useEffect } from 'react';
import { useFocus } from '../../hooks/useFocus';
import { api } from '../../services/api';
import { useCalendar } from '../../hooks/useCalendar';
import './../../styles/screens.css';
import './../../styles/design-system.css';

export const Focus: React.FC = () => {
  const { isActive, duration, remainingSeconds, startFocus, stopFocus } = useFocus();
  const { nextMeeting, timeUntilMeeting } = useCalendar();
  const [customMinutes, setCustomMinutes] = useState<number>(30);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [meetingSuggestions, setMeetingSuggestions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isNotificationsMuted, setIsNotificationsMuted] = useState<boolean>(false);
  const [muteRemainingSeconds, setMuteRemainingSeconds] = useState<number | null>(null);
  const [showMuteOptions, setShowMuteOptions] = useState<boolean>(false);
  const [muteDuration, setMuteDuration] = useState<number>(30);
  const [isOpeningSettings, setIsOpeningSettings] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [pausedSeconds, setPausedSeconds] = useState<number | null>(null);
  const [showRescheduleOptions, setShowRescheduleOptions] = useState<boolean>(false);
  const [rescheduleOptIn, setRescheduleOptIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('focus_reschedule_opt_in');
    return saved ? JSON.parse(saved) : false;
  });

  // Check for active session when component becomes visible
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('[Focus UI] Component mounted, checking for active session...');
        const active = await api.isFocusActive();
        console.log('[Focus UI] Active check result:', active);
        
        if (active) {
          const session = await api.getCurrentFocusSession();
          console.log('[Focus UI] Active session found:', session);
          const remaining = await api.getFocusRemainingSeconds();
          console.log('[Focus UI] Remaining seconds:', remaining);
        }
      } catch (err) {
        console.error('[Focus UI] Error checking session:', err);
      }
    };
    
    checkSession();
    // Also check periodically when not active (in case session was started elsewhere)
    const interval = setInterval(checkSession, 2000);
    return () => clearInterval(interval);
  }, []);

  // Load meeting suggestions when focus is active
  useEffect(() => {
    if (isActive) {
      const loadSuggestions = async () => {
        try {
          const suggestions = await api.getMeetingSuggestions();
          setMeetingSuggestions(suggestions || []);
        } catch (err) {
          console.error('Error loading meeting suggestions:', err);
        }
      };
      loadSuggestions();
    } else {
      setMeetingSuggestions([]);
    }
  }, [isActive]);

  // Check notification mute status
  useEffect(() => {
    const checkMuteStatus = async () => {
      try {
        const muted = await api.isNotificationsMuted();
        setIsNotificationsMuted(muted);
        
        if (muted) {
          const remaining = await api.getTemporaryMuteRemaining();
          setMuteRemainingSeconds(remaining);
        } else {
          setMuteRemainingSeconds(null);
        }
      } catch (err) {
        console.error('Error checking mute status:', err);
      }
    };

    checkMuteStatus();
    const interval = setInterval(checkMuteStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Listen for notification restore events
  useEffect(() => {
    const handleRestore = () => {
      setIsNotificationsMuted(false);
      setMuteRemainingSeconds(null);
    };

    // Tauri event listener would go here if needed
    // For now, polling handles it
    return () => {};
  }, []);

  const formatTime = (seconds: number | null) => {
    if (seconds === null || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Calculate progress percentage for circular indicator
  const getProgress = () => {
    if (!isActive || remainingSeconds === null || duration === 0) return 0;
    const totalSeconds = duration * 60;
    const elapsed = totalSeconds - remainingSeconds;
    return Math.min(100, Math.max(0, (elapsed / totalSeconds) * 100));
  };

  // Handle pause/resume
  const handlePause = () => {
    if (remainingSeconds !== null) {
      setPausedSeconds(remainingSeconds);
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    setIsPaused(false);
    setPausedSeconds(null);
  };

  // Handle meeting reschedule
  const handleRescheduleMeeting = async (minutes: number) => {
    if (!nextMeeting) return;
    try {
      setError(null);
      // TODO: Implement reschedule API call
      // await api.rescheduleMeeting(nextMeeting.id, minutes);
      console.log(`[Focus] Rescheduling meeting by ${minutes} minutes`);
      setShowRescheduleOptions(false);
      // For now, just show a success message
      alert(`Meeting rescheduled by ${minutes} minutes. (Backend implementation needed)`);
    } catch (err: any) {
      setError(err?.message || 'Failed to reschedule meeting');
      console.error('Error rescheduling meeting:', err);
    }
  };

  // Save reschedule opt-in preference
  useEffect(() => {
    localStorage.setItem('focus_reschedule_opt_in', JSON.stringify(rescheduleOptIn));
  }, [rescheduleOptIn]);

  const handleStartFocus = async (mode: 'focus1' | 'focus15' | 'focus25' | 'deepwork60' | 'clearinbox10' | 'prepformeeting' | 'custom', customMins?: number) => {
    try {
      setError(null);
      console.log('[Focus UI] Starting focus mode:', mode, customMins);
      await startFocus(mode, customMins);
      console.log('[Focus UI] ✓ Focus mode started successfully');
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || 'Failed to start focus mode';
      setError(errorMsg);
      console.error('[Focus UI] ✗ Error starting focus mode:', err);
      console.error('[Focus UI] Error details:', {
        message: err?.message,
        stack: err?.stack,
        toString: err?.toString(),
        fullError: err
      });
    }
  };

  const handleStopFocus = async () => {
    try {
      setError(null);
      await stopFocus();
    } catch (err: any) {
      setError(err?.message || 'Failed to stop focus mode');
      console.error('Error stopping focus mode:', err);
    }
  };

  const handleMuteNotifications = async (duration?: number) => {
    try {
      setError(null);
      await api.temporarilyMuteNotifications(duration);
      setIsNotificationsMuted(true);
      if (duration) {
        setMuteRemainingSeconds(duration * 60);
      }
      setShowMuteOptions(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to mute notifications');
      console.error('Error muting notifications:', err);
    }
  };

  const handleUnmuteNotifications = async () => {
    try {
      setError(null);
      await api.unmuteNotifications();
      setIsNotificationsMuted(false);
      setMuteRemainingSeconds(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to unmute notifications');
      console.error('Error unmuting notifications:', err);
    }
  };

  // Active focus session view
  if (isActive) {
    return (
      <div className="screen">
        <div className="section">
          <div className="section-header">
            <h3 className="section-title">🎯 Focus Session Active</h3>
            <button 
              onClick={handleStopFocus}
              className="button button-secondary"
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              Stop Focus
            </button>
          </div>

          {/* Timer Display with Circular Progress */}
          <div style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            background: 'var(--bg-elevated, rgba(255, 255, 255, 0.05))',
            borderRadius: '12px',
            marginBottom: '2rem',
            border: '2px solid var(--accent, #3b82f6)'
          }}>
            {/* Circular Progress Indicator */}
            <div style={{
              position: 'relative',
              width: '200px',
              height: '200px',
              margin: '0 auto 2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="200" height="200" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background circle */}
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="8"
                />
                {/* Progress circle */}
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="var(--accent, #3b82f6)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 90}`}
                  strokeDashoffset={`${2 * Math.PI * 90 * (1 - getProgress() / 100)}`}
                  style={{
                    transition: 'stroke-dashoffset 0.5s ease'
                  }}
                />
              </svg>
              {/* Time display in center */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '3rem',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                color: 'var(--accent, #3b82f6)'
              }}>
                {formatTime(isPaused ? pausedSeconds : remainingSeconds)}
              </div>
            </div>
            
            {/* Pause/Resume Button */}
            <div style={{ marginBottom: '1rem' }}>
              {!isPaused ? (
                <button
                  onClick={handlePause}
                  className="button button-secondary"
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.875rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  ⏸️ Pause
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  className="button button-primary"
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.875rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  ▶️ Resume
                </button>
              )}
            </div>

            <div style={{
              fontSize: '1.25rem',
              opacity: 0.8,
              marginBottom: '0.5rem'
            }}>
              {duration} minute focus session
              {isPaused && <span style={{ color: '#fbbf24', marginLeft: '0.5rem' }}>⏸️ Paused</span>}
            </div>
            <div style={{
              fontSize: '0.875rem',
              opacity: 0.8,
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px'
            }}>
              {isActive ? (
                <>
                  <div style={{ color: '#fca5a5', marginBottom: '0.5rem', fontWeight: '500' }}>
                    ⚠️ Windows 11 24H2 Limitation
                  </div>
                  <div style={{ color: '#e5e7eb', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                    Focus Assist cannot be enabled automatically from desktop apps. Please enable it manually to mute notifications.
                  </div>
                  <button
                    onClick={async () => {
                      // Prevent multiple rapid clicks
                      if (isOpeningSettings) return;
                      setIsOpeningSettings(true);
                      try {
                        await api.openFocusAssistSettings();
                      } catch (err) {
                        console.error('Error opening settings:', err);
                        // Don't show alert - just log the error
                      } finally {
                        // Reset after a delay to prevent rapid clicking
                        setTimeout(() => setIsOpeningSettings(false), 2000);
                      }
                    }}
                    disabled={isOpeningSettings}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(59, 130, 246, 0.3)',
                      border: '1px solid rgba(59, 130, 246, 0.6)',
                      borderRadius: '6px',
                      color: '#93c5fd',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginRight: '0.5rem'
                    }}
                  >
                    📱 Open Windows Settings
                  </button>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                    <strong>Quick method:</strong> Press <kbd style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px' }}>Win+A</kbd> → Click <strong>Focus Assist</strong> → Set to <strong>"Alarms only"</strong>
                  </div>
                </>
              ) : (
                <div style={{ color: '#9ca3af' }}>Ready to start focus session</div>
              )}
            </div>
          </div>

          {/* Notification Mute Controls */}
          <div className="section" style={{ marginTop: '2rem' }}>
            <div className="section-header">
              <h3 className="section-title">🔕 Notifications</h3>
              {!isNotificationsMuted && (
                <button
                  onClick={() => setShowMuteOptions(!showMuteOptions)}
                  className="button button-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  Mute Notifications
                </button>
              )}
              {isNotificationsMuted && (
                <button
                  onClick={handleUnmuteNotifications}
                  className="button button-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  Unmute
                </button>
              )}
            </div>

            {isNotificationsMuted && (
              <div style={{
                padding: '1rem',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                marginTop: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>🔇</span>
                  <span style={{ fontWeight: 600 }}>Notifications are muted</span>
                </div>
                {muteRemainingSeconds !== null && muteRemainingSeconds > 0 && (
                  <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                    Auto-unmute in: {formatTime(muteRemainingSeconds)}
                  </div>
                )}
                {muteRemainingSeconds === null && (
                  <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                    Muted until manually unmuted
                  </div>
                )}
                <div style={{
                  fontSize: '0.75rem',
                  opacity: 0.7,
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontWeight: 500, marginBottom: '0.25rem', color: '#fca5a5' }}>
                    ⚠️ Still seeing notifications?
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    Windows may require manual Focus Assist activation. Try:
                  </div>
                  <div style={{ fontSize: '0.7rem', lineHeight: '1.5' }}>
                    <strong>Quick method:</strong> Press <kbd style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px' }}>Win+A</kbd> → Click <strong>Focus Assist</strong> → Set to <strong>"Alarms only"</strong>
                  </div>
                  <button
                    onClick={async () => {
                      // Prevent multiple rapid clicks
                      if (isOpeningSettings) return;
                      setIsOpeningSettings(true);
                      try {
                        await api.openFocusAssistSettings();
                      } catch (err) {
                        console.error('Error opening settings:', err);
                      } finally {
                        // Reset after a delay to prevent rapid clicking
                        setTimeout(() => setIsOpeningSettings(false), 2000);
                      }
                    }}
                    disabled={isOpeningSettings}
                    style={{
                      marginTop: '0.5rem',
                      padding: '6px 12px',
                      background: 'rgba(59, 130, 246, 0.3)',
                      border: '1px solid rgba(59, 130, 246, 0.6)',
                      borderRadius: '6px',
                      color: '#93c5fd',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: '500'
                    }}
                  >
                    📱 Open Windows Settings
                  </button>
                </div>
              </div>
            )}

            {showMuteOptions && !isNotificationsMuted && (
              <div style={{
                marginTop: '1rem',
                padding: '1.5rem',
                background: 'var(--bg-elevated, rgba(255, 255, 255, 0.05))',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Mute notifications for:
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: '0.5rem'
                }}>
                  <button
                    onClick={() => handleMuteNotifications(15)}
                    className="button button-secondary"
                    style={{ padding: '0.75rem' }}
                  >
                    15 min
                  </button>
                  <button
                    onClick={() => handleMuteNotifications(30)}
                    className="button button-secondary"
                    style={{ padding: '0.75rem' }}
                  >
                    30 min
                  </button>
                  <button
                    onClick={() => handleMuteNotifications(60)}
                    className="button button-secondary"
                    style={{ padding: '0.75rem' }}
                  >
                    1 hour
                  </button>
                  <button
                    onClick={() => handleMuteNotifications(120)}
                    className="button button-secondary"
                    style={{ padding: '0.75rem' }}
                  >
                    2 hours
                  </button>
                  <button
                    onClick={() => handleMuteNotifications()}
                    className="button button-secondary"
                    style={{ padding: '0.75rem' }}
                  >
                    Until unmuted
                  </button>
                </div>
                <button
                  onClick={() => setShowMuteOptions(false)}
                  className="button button-text"
                  style={{ padding: '0.5rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Upcoming Meeting Display */}
          {nextMeeting && rescheduleOptIn && (
            <div className="section" style={{ marginTop: '2rem' }}>
              <div className="section-header">
                <h3 className="section-title">📅 Upcoming Meeting</h3>
                <button
                  onClick={() => setShowRescheduleOptions(!showRescheduleOptions)}
                  className="button button-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  Reschedule
                </button>
              </div>
              <div style={{
                padding: '1rem',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                marginTop: '1rem'
              }}>
                <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>
                  {nextMeeting.title || 'Untitled Meeting'}
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.25rem' }}>
                  📅 {new Date(nextMeeting.start_time * 1000).toLocaleString()}
                </div>
                {timeUntilMeeting !== null && (
                  <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                    ⏰ Starts in {formatTime(timeUntilMeeting)}
                  </div>
                )}
                {showRescheduleOptions && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                      Reschedule by:
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '0.5rem',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={() => handleRescheduleMeeting(15)}
                        className="button button-secondary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      >
                        +15 minutes
                      </button>
                      <button
                        onClick={() => handleRescheduleMeeting(30)}
                        className="button button-secondary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      >
                        +30 minutes
                      </button>
                      <button
                        onClick={() => setShowRescheduleOptions(false)}
                        className="button button-text"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Meeting Suggestions */}
          {meetingSuggestions.length > 0 && (
            <div className="section" style={{ marginTop: '2rem' }}>
              <div className="section-header">
                <h3 className="section-title">📅 Meeting Reschedule Suggestions</h3>
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '1rem' }}>
                These meetings conflict with your focus session. Consider rescheduling them.
              </div>
              <div className="list">
                {meetingSuggestions.map((suggestion, idx) => (
                  <div key={idx} className="list-item" style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '0.5rem'
                  }}>
                    <div className="list-item-icon">⚠️</div>
                    <div className="list-item-content" style={{ flex: 1 }}>
                      <div className="list-item-title">{suggestion.title}</div>
                      <div className="list-item-subtitle" style={{ marginTop: '0.5rem' }}>
                        <strong>Original time:</strong> {new Date(suggestion.original_time * 1000).toLocaleString()}
                      </div>
                      <div className="list-item-subtitle" style={{ marginTop: '0.25rem', color: '#60a5fa' }}>
                        <strong>Suggested time:</strong> {new Date(suggestion.suggested_time * 1000).toLocaleString()}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        opacity: 0.7,
                        marginTop: '0.5rem',
                        padding: '0.5rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '4px'
                      }}>
                        {suggestion.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Focus mode selection view
  return (
    <div className="screen">
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">🎯 Focus Mode</h3>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem'
        }}>
          {/* Focus 1 (Testing) */}
          <button
            onClick={() => handleStartFocus('focus1')}
            className="button button-primary"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem'
            }}
          >
            <div style={{ fontSize: '2rem' }}>🧪</div>
            <div style={{ fontWeight: 600 }}>Focus 1</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>1 minute (Testing)</div>
          </button>

          {/* Focus 15 */}
          <button
            onClick={() => handleStartFocus('focus15')}
            className="button button-primary"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem'
            }}
          >
            <div style={{ fontSize: '2rem' }}>⚡</div>
            <div style={{ fontWeight: 600 }}>Focus 15</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>15 minutes</div>
          </button>

          {/* Focus 25 (Pomodoro) */}
          <button
            onClick={() => handleStartFocus('focus25')}
            className="button button-primary"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem'
            }}
          >
            <div style={{ fontSize: '2rem' }}>🍅</div>
            <div style={{ fontWeight: 600 }}>Focus 25</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>25 minutes (Pomodoro)</div>
          </button>

          {/* Deep Work 60 */}
          <button
            onClick={() => handleStartFocus('deepwork60')}
            className="button button-primary"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem'
            }}
          >
            <div style={{ fontSize: '2rem' }}>🧠</div>
            <div style={{ fontWeight: 600 }}>Deep Work 60</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>60 minutes</div>
          </button>

          {/* Clear Inbox 10 */}
          <button
            onClick={() => handleStartFocus('clearinbox10')}
            className="button button-primary"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem'
            }}
          >
            <div style={{ fontSize: '2rem' }}>📧</div>
            <div style={{ fontWeight: 600 }}>Clear Inbox 10</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>10 minutes</div>
          </button>

          {/* Prep for Meeting */}
          <button
            onClick={() => handleStartFocus('prepformeeting')}
            className="button button-primary"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem'
            }}
          >
            <div style={{ fontSize: '2rem' }}>📅</div>
            <div style={{ fontWeight: 600 }}>Prep for Meeting</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>15 minutes</div>
          </button>

          {/* Custom Duration */}
          <button
            onClick={() => setShowCustomInput(!showCustomInput)}
            className="button button-secondary"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem'
            }}
          >
            <div style={{ fontSize: '2rem' }}>⚙️</div>
            <div style={{ fontWeight: 600 }}>Custom</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Set duration</div>
          </button>
        </div>

        {/* Custom Duration Input */}
        {showCustomInput && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1.5rem',
            background: 'var(--bg-elevated, rgba(255, 255, 255, 0.05))',
            borderRadius: '8px',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center'
          }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Duration (minutes):
            </label>
            <input
              type="number"
              min="1"
              max="240"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 30)}
              style={{
                padding: '0.5rem',
                background: 'var(--bg, #1a1a1a)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                borderRadius: '6px',
                color: 'var(--text, #ffffff)',
                fontSize: '0.875rem',
                width: '100px'
              }}
            />
            <button
              onClick={() => handleStartFocus('custom', customMinutes)}
              className="button button-primary"
              style={{ padding: '0.5rem 1.5rem' }}
            >
              Start Custom Focus
            </button>
            <button
              onClick={() => setShowCustomInput(false)}
              className="button button-text"
              style={{ padding: '0.5rem 1rem' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Notification Mute Section (when not in focus mode) */}
        <div className="section" style={{ marginTop: '2rem' }}>
          <div className="section-header">
            <h3 className="section-title">🔕 Temporarily Mute Notifications</h3>
            {!isNotificationsMuted && (
              <button
                onClick={() => setShowMuteOptions(!showMuteOptions)}
                className="button button-secondary"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                Mute Now
              </button>
            )}
            {isNotificationsMuted && (
              <button
                onClick={handleUnmuteNotifications}
                className="button button-secondary"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                Unmute
              </button>
            )}
          </div>

          {isNotificationsMuted && (
            <div style={{
              padding: '1rem',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              marginTop: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🔇</span>
                <span style={{ fontWeight: 600 }}>Notifications are muted</span>
              </div>
              {muteRemainingSeconds !== null && muteRemainingSeconds > 0 && (
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Auto-unmute in: {formatTime(muteRemainingSeconds)}
                </div>
              )}
              {muteRemainingSeconds === null && (
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Muted until manually unmuted
                </div>
              )}
            </div>
          )}

          {showMuteOptions && !isNotificationsMuted && (
            <div style={{
              marginTop: '1rem',
              padding: '1.5rem',
              background: 'var(--bg-elevated, rgba(255, 255, 255, 0.05))',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                Mute notifications for:
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '0.5rem'
              }}>
                <button
                  onClick={() => handleMuteNotifications(15)}
                  className="button button-secondary"
                  style={{ padding: '0.75rem' }}
                >
                  15 min
                </button>
                <button
                  onClick={() => handleMuteNotifications(30)}
                  className="button button-secondary"
                  style={{ padding: '0.75rem' }}
                >
                  30 min
                </button>
                <button
                  onClick={() => handleMuteNotifications(60)}
                  className="button button-secondary"
                  style={{ padding: '0.75rem' }}
                >
                  1 hour
                </button>
                <button
                  onClick={() => handleMuteNotifications(120)}
                  className="button button-secondary"
                  style={{ padding: '0.75rem' }}
                >
                  2 hours
                </button>
                <button
                  onClick={() => handleMuteNotifications()}
                  className="button button-secondary"
                  style={{ padding: '0.75rem' }}
                >
                  Until unmuted
                </button>
              </div>
              <button
                onClick={() => setShowMuteOptions(false)}
                className="button button-text"
                style={{ padding: '0.5rem', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
            </div>
          )}

          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '6px',
            fontSize: '0.75rem',
            opacity: 0.8
          }}>
            💡 You can mute notifications independently of focus mode. This is useful when you need quiet time without starting a focus session.
          </div>
        </div>

        {/* Reschedule Opt-in Preference */}
        <div className="section" style={{ marginTop: '2rem' }}>
          <div className="section-header">
            <h3 className="section-title">⚙️ Meeting Reschedule</h3>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}>
              <input
                type="checkbox"
                checked={rescheduleOptIn}
                onChange={(e) => setRescheduleOptIn(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Enable meeting reschedule suggestions</span>
            </label>
          </div>
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '6px',
            fontSize: '0.75rem',
            opacity: 0.8
          }}>
            💡 When enabled, you'll see upcoming meetings and can reschedule them by 15 or 30 minutes to avoid conflicts with your focus sessions.
          </div>
        </div>

        {/* Info Section */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '8px',
          fontSize: '0.875rem'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent, #3b82f6)' }}>
            ℹ️ What happens when you start Focus Mode?
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', opacity: 0.9 }}>
            <li>Windows Focus Assist will be enabled (Alarms only mode)</li>
            <li>All notifications will be muted except alarms</li>
            <li>Timer will count down and notify you when complete</li>
            <li>You can pause and resume the timer anytime</li>
            <li>Notifications will be automatically restored when focus ends</li>
            <li>Meeting conflicts will be detected and suggestions provided</li>
          </ul>
        </div>

        {error && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            color: '#ef4444',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
