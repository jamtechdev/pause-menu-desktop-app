import React, { useState } from 'react';
import { useCalendar, CalendarEvent } from '../../hooks/useCalendar';
import { formatTime } from '../../utils/timeUtils';
import { OAuthCallback } from './OAuthCallback';
import { api } from '../../services/api';
import './../../styles/screens.css';

export const CalendarEvents: React.FC = () => {
  const { 
    events, 
    nextMeeting, 
    timeUntilMeeting, 
    loading,
    setLoading,
    error,
    setError,
    isAuthenticated,
    setIsAuthenticated,
    authenticateGoogle,
    refreshEvents 
  } = useCalendar();
  
  const [showOAuthCallback, setShowOAuthCallback] = useState(false);

  const formatMeetingTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatMeetingDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const formatTimeUntil = (seconds: number | null) => {
    if (!seconds || seconds < 0) return null;
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (minutes === 0) {
        return `${hours}h`;
      }
      return `${hours}h ${minutes}m`;
    }
  };

  const handleAuthenticate = async () => {
    try {
      console.log('[Calendar] ===== OAuth flow starting =====');
      console.log('[Calendar] Button clicked, handleAuthenticate called');
      setLoading(true);
      setError(null);
      
      // Use automatic OAuth flow - no manual code entry needed!
      console.log('[Calendar] Importing event listener...');
      const { listen } = await import('@tauri-apps/api/event');
      console.log('[Calendar] Event listener imported');
      
      // Listen for OAuth success/error events
      let unlistenSuccess: (() => void) | null = null;
      let unlistenError: (() => void) | null = null;
      
      console.log('[Calendar] Setting up event listeners...');
      unlistenSuccess = await listen('oauth-success', () => {
        console.log('[Calendar] ✓ OAuth success event received');
        setShowOAuthCallback(false);
        setLoading(false);
        
        // Immediately set authenticated to true (optimistic update)
        setIsAuthenticated(true);
        
        // Force check authentication status after a brief delay to ensure token is stored
        // Use a small delay to allow token storage to complete
        setTimeout(() => {
          (async () => {
            try {
              console.log('[Calendar] Checking authentication status after OAuth success...');
              const authenticated = await api.isCalendarAuthenticated();
              console.log('[Calendar] Authentication status after OAuth:', authenticated);
              setIsAuthenticated(authenticated);
              
              if (authenticated) {
                console.log('[Calendar] Authenticated confirmed, refreshing events...');
                // Refresh events to show calendar data
                await refreshEvents();
              } else {
                console.warn('[Calendar] OAuth succeeded but authentication check returned false');
                console.warn('[Calendar] This might mean token storage failed. Retrying...');
                // Try again after a bit more time
                setTimeout(async () => {
                  const retryAuth = await api.isCalendarAuthenticated();
                  console.log('[Calendar] Retry authentication status:', retryAuth);
                  setIsAuthenticated(retryAuth);
                  if (retryAuth) {
                    await refreshEvents();
                  } else {
                    console.error('[Calendar] Authentication check still failing after retry');
                    setError(new Error('Authentication succeeded but token storage may have failed. Please try connecting again.'));
                  }
                }, 1000);
              }
            } catch (err) {
              console.error('[Calendar] Error checking authentication after OAuth:', err);
              setError(err as Error);
            }
          })();
        }, 500);
        
        if (unlistenSuccess) unlistenSuccess();
        if (unlistenError) unlistenError();
      });
      
      unlistenError = await listen('oauth-error', (event: any) => {
        console.error('[Calendar] ✗ OAuth error event received:', event.payload);
        const errorMsg = event.payload as string || 'OAuth failed';
        setError(new Error(errorMsg));
        setShowOAuthCallback(false);
        setLoading(false);
        if (unlistenSuccess) unlistenSuccess();
        if (unlistenError) unlistenError();
      });
      console.log('[Calendar] Event listeners set up');
      
      // Start automatic OAuth flow
      // This will:
      // 1. Open browser automatically
      // 2. User authorizes
      // 3. Callback is automatically captured
      // 4. Calendar connects automatically
      console.log('[Calendar] Calling api.startGoogleOAuthFlow()...');
      try {
        const result = await api.startGoogleOAuthFlow();
        console.log('[Calendar] api.startGoogleOAuthFlow() returned:', result);
        if (result === null || result === undefined) {
          const errorMsg = 'Command returned null/undefined. Check TERMINAL (not browser console) for Rust backend logs starting with [OAuth] and [Env].';
          console.error('[Calendar]', errorMsg);
          throw new Error(errorMsg);
        }
      } catch (err: any) {
        console.error('[Calendar] ✗ Error calling startGoogleOAuthFlow:', err);
        console.error('[Calendar] Error message:', err?.message);
        console.error('[Calendar] IMPORTANT: Check the TERMINAL where you run the app for detailed [OAuth] and [Env] logs!');
        throw err; // Re-throw to be caught by outer catch
      }
      
      // Show message that browser will open
      // (Loading state is already set)
      console.log('[Calendar] OAuth flow initiated, waiting for callback...');
    } catch (err: any) {
      console.error('[Calendar] ✗✗✗ ERROR in handleAuthenticate ✗✗✗');
      console.error('[Calendar] Error details:', err);
      console.error('[Calendar] Error message:', err?.message);
      console.error('[Calendar] Error stack:', err?.stack);
      setError(new Error(err?.message || err?.toString() || 'Failed to start OAuth flow'));
      setLoading(false);
    }
  };

  const handleOAuthSuccess = () => {
    setShowOAuthCallback(false);
    refreshEvents();
  };

  // Debug: Log current state
  console.log('[Calendar] Render - isAuthenticated:', isAuthenticated, 'loading:', loading, 'events.length:', events.length, 'error:', error?.message);
  
  // Not authenticated state - show connect button
  // Show connect button if: not authenticated, not loading, and no events
  // OR if there's an error about authentication/configuration
  if ((!isAuthenticated || (error && error.message.includes('not configured')) || (error && error.message.includes('re-authenticate'))) && !loading) {
    return (
      <>
        {showOAuthCallback && (
          <OAuthCallback
            onSuccess={handleOAuthSuccess}
            onCancel={() => setShowOAuthCallback(false)}
          />
        )}
        <div className="section">
          <div className="section-header">
            <h3 className="section-title">📅 Calendar</h3>
          </div>
          <div className="empty-state">
            <div className="empty-state-icon">🔐</div>
            <div className="empty-state-title">Connect Google Calendar</div>
            <div className="empty-state-description">
              Sign in to see your upcoming meetings
            </div>
            <button 
              onClick={handleAuthenticate}
              className="button button-primary"
              disabled={loading}
              style={{ 
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              {loading ? 'Opening browser...' : 'Connect Google Calendar'}
            </button>
            <button 
              onClick={async () => {
                console.log('[Calendar] Manual refresh clicked');
                setLoading(true);
                try {
                  const auth = await api.isCalendarAuthenticated();
                  console.log('[Calendar] Manual check - authenticated:', auth);
                  setIsAuthenticated(auth);
                  await refreshEvents();
                } catch (err) {
                  console.error('[Calendar] Error in manual refresh:', err);
                  setError(err as Error);
                } finally {
                  setLoading(false);
                }
              }}
              className="button button-secondary"
              disabled={loading}
              style={{ 
                marginTop: '0.5rem',
                padding: '0.5rem 1rem',
                fontSize: '0.75rem',
                marginLeft: '0.5rem'
              }}
            >
              Refresh Status
            </button>
            {loading && (
              <p style={{ 
                marginTop: '0.75rem', 
                fontSize: '0.75rem', 
                opacity: 0.7 
              }}>
                A browser window will open. Please authorize the app there.
              </p>
            )}
            {error && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                color: '#ef4444',
                fontSize: '0.75rem'
              }}>
                {error.message}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Loading state
  if (loading && events.length === 0) {
    return (
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">📅 Calendar</h3>
        </div>
        <div className="loading-container">
          <div className="loading-text">Loading calendar...</div>
        </div>
      </div>
    );
  }

  // Error state - but check if it's an auth error
  if (error && events.length === 0 && isAuthenticated) {
    // Only show error state if authenticated but has error (API issue)
    // If not authenticated, show connect button instead
    const isAuthError = error.message.includes('not configured') || 
                       error.message.includes('re-authenticate') ||
                       error.message.includes('not authenticated');
    
    if (isAuthError) {
      // Show connect button for auth errors
      return (
        <>
          {showOAuthCallback && (
            <OAuthCallback
              onSuccess={handleOAuthSuccess}
              onCancel={() => setShowOAuthCallback(false)}
            />
          )}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">📅 Calendar</h3>
            </div>
            <div className="empty-state">
              <div className="empty-state-icon">🔐</div>
              <div className="empty-state-title">Connect Google Calendar</div>
              <div className="empty-state-description">
                {error.message.includes('not configured') 
                  ? 'Please configure Google Calendar credentials in .env file'
                  : 'Sign in to see your upcoming meetings'}
              </div>
              {!error.message.includes('not configured') && (
                <button 
                  onClick={handleAuthenticate}
                  className="button button-primary"
                  style={{ 
                    marginTop: '1rem',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  Connect Google Calendar
                </button>
              )}
            </div>
          </div>
        </>
      );
    }
    
    // Other errors (API issues)
    return (
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">📅 Calendar</h3>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Error loading calendar</div>
          <div className="empty-state-description">{error.message}</div>
          <button 
            onClick={refreshEvents}
            className="button button-primary"
            style={{ marginTop: '1rem' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Upcoming events
  const upcomingEvents = events.filter(e => e.start_time * 1000 > Date.now());

  return (
    <>
      {showOAuthCallback && (
        <OAuthCallback
          onSuccess={handleOAuthSuccess}
          onCancel={() => setShowOAuthCallback(false)}
        />
      )}

      <div className="section">
        <div className="section-header">
          <h3 className="section-title">📅 Calendar</h3>
          <button 
            onClick={refreshEvents}
            className="button button-text"
            style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
          >
            Refresh
          </button>
        </div>

        {/* Next Meeting Card */}
        {nextMeeting && timeUntilMeeting !== null && timeUntilMeeting > 0 && (
          <div 
            className="list-item"
            style={{ 
              background: 'var(--accent-subtle, rgba(59, 130, 246, 0.1))',
              border: '1px solid var(--accent, #3b82f6)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}
          >
            <div className="list-item-icon" style={{ fontSize: '1.5rem' }}>⏰</div>
            <div className="list-item-content" style={{ flex: 1 }}>
              <div className="list-item-title" style={{ fontWeight: 600 }}>
                {nextMeeting.title}
              </div>
              <div className="list-item-subtitle">
                {formatMeetingDate(nextMeeting.start_time)} at {formatMeetingTime(nextMeeting.start_time)}
                {nextMeeting.location && ` • ${nextMeeting.location}`}
              </div>
            </div>
            <div className="list-item-meta">
              <div style={{ 
                fontSize: '0.875rem', 
                fontWeight: 600,
                color: 'var(--accent, #3b82f6)'
              }}>
                {formatTimeUntil(timeUntilMeeting)}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                until meeting
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Events List */}
        {upcomingEvents.length === 0 ? (
          <div className="empty-state" style={{ padding: '1rem 0' }}>
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">No upcoming meetings</div>
            <div className="empty-state-description">You're all clear for the next 24 hours</div>
          </div>
        ) : (
          <div className="list">
            {upcomingEvents.slice(0, 5).map((event) => {
              const isNext = nextMeeting?.id === event.id;
              return (
                <div 
                  key={event.id} 
                  className="list-item"
                  style={isNext ? { 
                    borderLeft: '3px solid var(--accent, #3b82f6)',
                    paddingLeft: '0.75rem'
                  } : {}}
                >
                  <div className="list-item-icon">📅</div>
                  <div className="list-item-content">
                    <div className="list-item-title">{event.title}</div>
                    <div className="list-item-subtitle">
                      {formatMeetingDate(event.start_time)} • {formatMeetingTime(event.start_time)} - {formatMeetingTime(event.end_time)}
                      {event.location && ` • ${event.location}`}
                    </div>
                    {event.description && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        opacity: 0.7, 
                        marginTop: '0.25rem',
                        maxWidth: '400px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {event.description}
                      </div>
                    )}
                  </div>
                  <div className="list-item-meta">
                    <span className="list-item-time">
                      {formatMeetingTime(event.start_time)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
