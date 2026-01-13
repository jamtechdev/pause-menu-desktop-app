import { useState, useEffect } from 'react';
import { api } from '../services/api';

export interface CalendarEvent {
  id: string;
  title: string;
  start_time: number; // Unix timestamp in seconds
  end_time: number; // Unix timestamp in seconds
  location?: string;
  description?: string;
}

export const useCalendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [nextMeeting, setNextMeeting] = useState<CalendarEvent | null>(null);
  const [timeUntilMeeting, setTimeUntilMeeting] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const refreshEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      // First check authentication status
      console.log('[Calendar] Checking authentication status...');
      const authenticated = await api.isCalendarAuthenticated();
      console.log('[Calendar] Authentication status:', authenticated);
      setIsAuthenticated(authenticated);
      
      if (!authenticated) {
        console.log('[Calendar] Not authenticated, clearing events');
        setEvents([]);
        setNextMeeting(null);
        setTimeUntilMeeting(null);
        setLoading(false);
        return;
      }
      
      console.log('[Calendar] Authenticated, fetching events...');

      // First refresh events from the API (this fetches and caches them)
      console.log('[Calendar] Refreshing calendar events from API...');
      await api.refreshCalendarEvents();
      console.log('[Calendar] ✓ Events refreshed from API');

      // Then get the cached events
      const data = await api.getCalendarEvents();
      const eventsList = (data || []) as CalendarEvent[];
      console.log('[Calendar] Received events from cache:', eventsList.length);
      console.log('[Calendar] Events data:', eventsList);
      setEvents(eventsList);
      
      // Get next meeting
      const next = await api.getNextMeeting();
      if (next) {
        setNextMeeting(next as CalendarEvent);
      } else {
        setNextMeeting(null);
      }
      
      // Get time until next meeting
      const timeUntil = await api.timeUntilNextMeeting();
      setTimeUntilMeeting(timeUntil);
    } catch (err: any) {
      setError(err as Error);
      const errorMsg = err?.message || err?.toString() || '';
      
      // Check if error indicates not authenticated or not configured
      if (
        errorMsg.includes('not configured') || 
        errorMsg.includes('not authenticated') ||
        errorMsg.includes('Client ID not configured') ||
        errorMsg.includes('Client Secret not configured') ||
        errorMsg.includes('Token expired') ||
        errorMsg.includes('Failed to retrieve token') ||
        errorMsg.includes('Please re-authenticate')
      ) {
        setIsAuthenticated(false);
        setEvents([]);
        setNextMeeting(null);
        setTimeUntilMeeting(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 5 minutes
  useEffect(() => {
    refreshEvents();
    const interval = setInterval(refreshEvents, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Update time until meeting every minute
  useEffect(() => {
    if (!nextMeeting) return;
    
    const updateTimeUntil = async () => {
      const timeUntil = await api.timeUntilNextMeeting();
      setTimeUntilMeeting(timeUntil);
    };
    
    updateTimeUntil();
    const interval = setInterval(updateTimeUntil, 60000); // Every minute
    return () => clearInterval(interval);
  }, [nextMeeting]);

  const authenticateGoogle = async () => {
    try {
      const authUrl = await api.getGoogleAuthUrl();
      // Open OAuth URL in default browser
      window.open(authUrl, '_blank');
      return authUrl;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const handleOAuthCallback = async (code: string) => {
    try {
      await api.handleOAuthCallback('google', code);
      await refreshEvents();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return { 
    events, 
    nextMeeting,
    timeUntilMeeting,
    loading,
    setLoading,
    error,
    setError,
    isAuthenticated,
    setIsAuthenticated,
    refreshEvents,
    authenticateGoogle,
    handleOAuthCallback
  };
};

