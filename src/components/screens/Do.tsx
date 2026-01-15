import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, RecentFile, WindowInfo } from '../../services/api';
import { useOverlayStore } from '../../stores/overlayStore';
import { CalendarEvents } from '../common/CalendarEvents';
import './../../styles/screens.css';
import './../../styles/design-system.css';

type CalendarEvent = {
  id: string;
  title: string;
  start_time: number; // seconds since epoch (chrono::serde::ts_seconds)
  end_time: number; // seconds since epoch
  location?: string | null;
  description?: string | null;
};

type DoAction = {
  id: string;
  icon: string;
  title: string;
  description?: string;
  timeEstimate?: string;
  confidence: number; // 0..1
  run: () => Promise<void>;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatMinutes(seconds: number): string {
  const mins = Math.max(0, Math.round(seconds / 60));
  if (mins <= 1) return '1 min';
  return `${mins} min`;
}

function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  // Basic URL matcher; trims trailing punctuation.
  const match = text.match(/https?:\/\/[^\s)]+/i);
  if (!match) return null;
  return match[0].replace(/[),.]+$/g, '');
}

function getDirFromPath(p: string): string | null {
  if (!p) return null;
  const normalized = p.replace(/\//g, '\\');
  const idx = normalized.lastIndexOf('\\');
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
}

function looksLikeUnsavedTitle(title: string): boolean {
  // Common "dirty" markers across editors
  return (
    title.includes('●') ||
    title.includes('•') ||
    title.includes('*') ||
    title.toLowerCase().includes('unsaved') ||
    title.toLowerCase().includes('not saved')
  );
}

function looksLikeEditorProcess(processName: string): boolean {
  const p = processName.toLowerCase();
  return (
    p.includes('cursor') ||  // Cursor IDE
    p.includes('code') ||    // VS Code
    p.includes('notepad') ||
    p.includes('word') ||
    p.includes('excel') ||
    p.includes('powerpnt') ||
    p.includes('sublime') ||
    p.includes('obsidian') ||
    p.includes('notion') ||
    p.includes('onenote')
  );
}

function looksLikeEmailDraftWindow(w: WindowInfo): boolean {
  const title = (w.title || '').toLowerCase();
  const proc = (w.process_name || '').toLowerCase();
  
  // Check if it's an email client
  const maybeMailApp =
    proc.includes('outlook') || 
    proc.includes('thunderbird') || 
    proc.includes('mail') ||
    proc.includes('mailbird') ||
    proc.includes('postbox');
  
  // Check if it's a browser (for webmail like Gmail, Outlook.com)
  const maybeBrowser = proc.includes('chrome') || 
                      proc.includes('msedge') || 
                      proc.includes('edge') ||
                      proc.includes('firefox') ||
                      proc.includes('brave') ||
                      proc.includes('opera');
  
  // Check for explicit draft indicators in title
  const explicitDraft = title.includes('draft') || 
                        title.includes('unsent') || 
                        title.includes('compose') || 
                        title.includes('reply') ||
                        title.includes('new message') ||
                        title.includes('composing');
  
  // For email apps, check if window title suggests it's a draft/compose window
  if (maybeMailApp) {
    return explicitDraft || title.includes('compose') || title.includes('new message');
  }
  
  // For browsers, check multiple heuristics for email drafts
  if (maybeBrowser) {
    // 1) Explicit draft indicators (most reliable)
    if (explicitDraft) {
      return true;
    }
    
    // 2) Check for Gmail compose window patterns
    // Gmail compose windows often have titles like:
    // - "New Message" (when starting fresh)
    // - Email subject (when composing with subject)
    // - "Gmail" or "Mail" in title
    const isGmail = title.includes('gmail') || 
                   title.includes('mail.google.com') ||
                   (title.includes('mail') && !title.includes('outlook.com'));
    
    // 3) Check if title looks like an email subject (heuristic)
    // Email subjects are usually:
    // - Not too long (typically < 100 chars)
    // - Not common browser tab names
    // - Don't contain common browser UI words
    const commonBrowserTabs = ['new tab', 'settings', 'about:', 'chrome://', 'edge://', 
                               'firefox', 'home', 'start page', 'welcome', 'downloads',
                               'history', 'bookmarks', 'extensions'];
    const isCommonTab = commonBrowserTabs.some(tab => title.includes(tab));
    
    // If it's a Gmail tab and not a common browser tab, it might be a compose window
    // Also check if title is reasonably short (likely an email subject, not a full page title)
    if (isGmail && !isCommonTab && title.length > 0 && title.length < 150) {
      // Additional check: if title doesn't look like a full page title (no " - " separator)
      // Gmail compose windows usually just show the subject, not "Subject - Gmail"
      const hasPageSeparator = title.includes(' - ') || title.includes(' | ');
      if (!hasPageSeparator) {
        return true; // Likely a Gmail compose window
      }
    }
    
    // 4) Check for Outlook.com compose patterns
    if (title.includes('outlook.com') || title.includes('outlook.live.com')) {
      // Outlook.com compose windows might just show the subject
      if (!isCommonTab && title.length > 0 && title.length < 150) {
        const hasPageSeparator = title.includes(' - ') || title.includes(' | ');
        if (!hasPageSeparator) {
          return true;
        }
      }
    }
  }
  
  return false;
}

function looksLikeBrowserProcess(processName: string): boolean {
  const p = (processName || '').toLowerCase();
  return p.includes('chrome') || p.includes('msedge') || p.includes('firefox') || p.includes('brave') || p.includes('opera');
}

/**
 * Clean email address from Gmail header format
 * Handles formats like:
 * - "John Doe <john@example.com>"
 * - "john@example.com"
 * - "John Doe <john@example.com>, Jane <jane@example.com>" (takes first)
 */
function cleanEmailAddress(emailHeader: string | null | undefined): string {
  if (!emailHeader) return '';
  
  // Trim whitespace
  let cleaned = emailHeader.trim();
  
  // If empty, return empty
  if (!cleaned) return '';
  
  // Handle multiple addresses (take the first one)
  const firstAddress = cleaned.split(',')[0].trim();
  
  // Extract email from "Name <email@example.com>" format
  const emailMatch = firstAddress.match(/<([^>]+)>/);
  if (emailMatch) {
    return emailMatch[1].trim();
  }
  
  // If no angle brackets, assume it's already just the email
  // But validate it looks like an email
  if (firstAddress.includes('@')) {
    return firstAddress.trim();
  }
  
  // If it doesn't look like an email, return as-is (will be validated later)
  return firstAddress;
}

/**
 * Basic email validation
 */
function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function looksLikeGoogleDocsWindow(w: WindowInfo): boolean {
  const title = (w.title || '').toLowerCase();
  // Common patterns:
  // - "Untitled document - Google Docs"
  // - "<Doc name> - Google Docs"
  // - "Google Docs" (sometimes truncated)
  return looksLikeBrowserProcess(w.process_name) && (title.includes('google docs') || title.includes('docs.google'));
}

export const Do: React.FC = () => {
  const isOverlayVisible = useOverlayStore((s) => s.isOverlayVisible);
  const [actions, setActions] = useState<DoAction[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsToNextMeeting, setSecondsToNextMeeting] = useState<number | null>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<{ url: string; title: string } | null>(null);
  const [meetingLoadError, setMeetingLoadError] = useState<boolean>(false);
  const [meetingJoined, setMeetingJoined] = useState<boolean>(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const refreshRef = useRef<(() => Promise<void>) | null>(null);

  const closeOverlay = useCallback(async () => {
    try {
      console.log('[Do] Closing overlay...');
      const store = useOverlayStore.getState();
      store.setOverlayVisible(false);
      await api.hideOverlay();
      console.log('[Do] Overlay closed successfully');
    } catch (error) {
      console.error('[Do] Error closing overlay:', error);
      // Still try to hide it in the store even if API call fails
      const store = useOverlayStore.getState();
      store.setOverlayVisible(false);
    }
  }, []);

  const buildActions = useCallback(
    async (windows: WindowInfo[], recentFiles: RecentFile[], nextMeeting: CalendarEvent | null, secondsUntil: number | null, gmailDrafts: any[] = [], allEvents: CalendarEvent[] = []) => {
      const candidates: DoAction[] = [];
      
      // Helper to calculate seconds until a meeting
      const getSecondsUntil = (event: CalendarEvent): number | null => {
        const now = Math.floor(Date.now() / 1000);
        const startTime = event.start_time;
        if (startTime <= now) return null;
        return startTime - now;
      };
      
      // Helper to extract meeting link
      const getMeetingLink = (event: CalendarEvent): string | null => {
        return extractFirstUrl(event.location || null) || extractFirstUrl(event.description || null);
      };
                                                                                                
      // Check if there's already an active focus session
      let isFocusActive = false;
      let currentSession: any = null;
      try {
        isFocusActive = await api.isFocusActive();
        if (isFocusActive) {
          currentSession = await api.getCurrentFocusSession();
        }
      } catch (error) {
        console.error('[Do] Error checking focus status:', error);
      }
      
      // If there's an active focus session, show option to stop it first
      if (isFocusActive && currentSession) {
        const remainingMins = Math.ceil((currentSession.remaining_seconds || 0) / 60);
        candidates.push({
          id: 'stop-focus-session',
          icon: '⏹',
          title: `Stop current focus session`,
          description: `${remainingMins} min remaining`,
          confidence: 0.8,
          run: async () => {
            try {
              console.log('[Do] Stopping focus mode...');
              await api.stopFocusMode();
              console.log('[Do] Focus mode stopped successfully');
              // Refresh actions after stopping
              setTimeout(() => refresh(), 500);
            } catch (error) {
              console.error('[Do] Failed to stop focus mode:', error);
              throw error;
            }
          },
        });
      }

      // 1) Show all upcoming meetings that can be joined (starts in ≤10 minutes)
      const upcomingMeetings = allEvents
        .filter(event => {
          const eventSecondsUntil = getSecondsUntil(event);
          return eventSecondsUntil !== null && 
                 eventSecondsUntil <= 10 * 60 && 
                 eventSecondsUntil >= -5 * 60; // Show meetings up to 5 minutes past start
        })
        .sort((a, b) => a.start_time - b.start_time); // Sort by start time

      for (const meeting of upcomingMeetings) {
        const meetingSecondsUntil = getSecondsUntil(meeting);
        if (meetingSecondsUntil === null) continue;
        
        const link = getMeetingLink(meeting);

        // Always show join button for meetings starting soon, even without detected link
        // If no link found, we'll try to create a Google Meet link or open calendar
        candidates.push({
          id: `join-meeting:${meeting.id}`,
          icon: '📞',
          title: `Join meeting: ${meeting.title || 'Meeting'}`,
          description: link ? `Starts in ${formatMinutes(meetingSecondsUntil)}` : `Starts in ${formatMinutes(meetingSecondsUntil)} • No link detected`,
          confidence: link ? 0.95 : 0.85,
          run: async () => {
            try {
              console.log('[Do] Join meeting clicked for:', meeting.title);
              console.log('[Do] Meeting data:', { location: meeting.location, description: meeting.description });
              
              // Try to find meeting link more thoroughly
              const fullText = `${meeting.location || ''} ${meeting.description || ''}`;
              console.log('[Do] Full text to search:', fullText);
              
              const allUrls = fullText.match(/(https?:\/\/[^\s<>"']+)/gi);
              console.log('[Do] Found URLs:', allUrls);
              
              const foundLink = link || (allUrls && allUrls.length > 0 ? allUrls[0] : null);
              
              // Open meeting in a new Tauri window (not iframe) - this works with Google Meet
              const urlToOpen = foundLink || 'https://meet.google.com/new';
              console.log('[Do] Opening meeting in Tauri window:', urlToOpen);
              
              try {
                await api.openMeetingWindow(urlToOpen, meeting.title || 'Meeting');
                setSuccessMessage('Meeting opened in new window');
                setTimeout(() => setSuccessMessage(null), 3000);
              } catch (error) {
                console.error('[Do] Failed to open meeting window:', error);
                // Fallback: try iframe approach
                setMeetingLoadError(false);
                setMeetingJoined(false);
                setActiveMeeting({
                  url: urlToOpen,
                  title: meeting.title || 'Meeting'
                });
              }
            } catch (error) {
              console.error('[Do] Error joining meeting:', error);
              setError(`Failed to join meeting: ${error instanceof Error ? error.message : String(error)}`);
            }
          },
        });
      }

      // 2) Prepare for meeting (start focus session) - shows if meeting is 10-60 minutes away
      // But only if there's no active focus session
      // Show for the next meeting only (to avoid too many actions)
      if (nextMeeting && typeof secondsUntil === 'number' && secondsUntil > 10 * 60 && secondsUntil <= 60 * 60 && !isFocusActive) {
        // Check if we already added a "join" or "prepare soon" action for this meeting
        const alreadyAdded = candidates.some(c => c.id.includes(nextMeeting.id));
        if (!alreadyAdded) {
          candidates.push({
            id: `prep-meeting:${nextMeeting.id}`,
            icon: '📝',
            title: `Prepare for meeting: ${nextMeeting.title || 'Upcoming meeting'}`,
            description: `Starts in ${formatMinutes(secondsUntil)}`,
            timeEstimate: '15 min',
            confidence: 0.85,
            run: async () => {
              try {
                console.log('[Do] Starting focus mode: prepformeeting');
                await api.startFocusMode('prepformeeting');
                console.log('[Do] Focus mode started successfully');
                await closeOverlay();
              } catch (error) {
                console.error('[Do] Failed to start focus mode:', error);
                throw error;
              }
            },
          });
        }
      }

      // 3) Finish draft (unsaved document/window)
      const nowMs = Date.now();
      
      // Debug: Log all windows and editor windows for troubleshooting
      console.log('[Do] Total windows:', windows.length);
      console.log('[Do] All windows (full details):', windows.map(w => ({
        process: w.process_name,
        processLower: w.process_name.toLowerCase(),
        title: w.title,
        lastActive: w.last_active,
        isEditor: looksLikeEditorProcess(w.process_name),
        hasUnsavedMarker: looksLikeUnsavedTitle(w.title)
      })));
      
      const editorWindows = windows.filter((w) => looksLikeEditorProcess(w.process_name));
      console.log('[Do] Editor windows found:', editorWindows.length);
      if (editorWindows.length > 0) {
        console.log('[Do] Editor windows details:', editorWindows.map(w => ({
          process: w.process_name,
          title: w.title,
          hasUnsavedMarker: looksLikeUnsavedTitle(w.title),
          isEditor: looksLikeEditorProcess(w.process_name),
          lastActive: w.last_active,
          ageMinutes: Math.round((nowMs - new Date(w.last_active).getTime()) / 60000)
        })));
      } else {
        // If no editors found, check what processes we have
        const allProcesses = [...new Set(windows.map(w => w.process_name.toLowerCase()))];
        console.log('[Do] All unique process names (lowercase):', allProcesses);
        console.log('[Do] Looking for Cursor in process names:', allProcesses.filter(p => p.includes('cursor')));
      }
      
      // Find ALL windows with explicit unsaved markers (●, •, *, etc.)
      const unsavedWindows = windows.filter((w) => looksLikeUnsavedTitle(w.title) && looksLikeEditorProcess(w.process_name));
      
      // Add each unsaved window as a separate action
      for (const unsaved of unsavedWindows) {
        // Extract process name for better description
        const processName = unsaved.process_name.replace(/\.exe$/i, '').toLowerCase();
        const editorName = processName === 'cursor' ? 'Cursor' : 
                          processName.includes('code') ? 'VS Code' :
                          processName.includes('notepad') ? 'Notepad' :
                          processName;
        
        console.log('[Do] Found unsaved draft:', unsaved.title, 'in', editorName);
        candidates.push({
          id: `finish-draft:${unsaved.handle}`,
          icon: '✍',
          title: `Finish draft (${editorName})`,
          description: unsaved.title.replace(/[●•*]/g, '').trim() || 'Unsaved document',
          timeEstimate: '12 min',
          confidence: 0.8,
          run: async () => {
            await api.bringWindowToFront(unsaved.handle);
            await closeOverlay();
          },
        });
      }
      
      // Fallback: Check for recently active editor windows (might be drafts)
      // Only if we didn't find any with explicit unsaved markers
      if (unsavedWindows.length === 0) {
        const recentEditors = windows
          .filter((w) => looksLikeEditorProcess(w.process_name))
          .filter((w) => {
            // Exclude Google Docs (handled separately) and email drafts
            if (looksLikeGoogleDocsWindow(w) || looksLikeEmailDraftWindow(w)) return false;
            return true;
          })
          .slice()
          .sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime())
          .filter((w) => {
            // Only include if active in last 15 minutes
            const lastActiveMs = new Date(w.last_active).getTime();
            const ageMs = nowMs - lastActiveMs;
            return ageMs >= 0 && ageMs <= 15 * 60 * 1000;
          })
          .slice(0, 3); // Limit to 3 most recent

        // Add each recent editor as a potential draft
        for (const recentEditor of recentEditors) {
          const processName = recentEditor.process_name.replace(/\.exe$/i, '').toLowerCase();
          const editorName = processName === 'cursor' ? 'Cursor' : 
                            processName.includes('code') ? 'VS Code' :
                            processName.includes('notepad') ? 'Notepad' :
                            processName;
          
          const lastActiveMs = new Date(recentEditor.last_active).getTime();
          const ageMs = nowMs - lastActiveMs;
          
          console.log('[Do] ✓ Adding recent editor as draft candidate:', {
            process: recentEditor.process_name,
            title: recentEditor.title,
            ageMinutes: Math.round(ageMs / 60000)
          });
          
          candidates.push({
            id: `finish-draft-recent:${recentEditor.handle}`,
            icon: '✍',
            title: `Finish draft (${editorName})`,
            description: recentEditor.title || 'Recent document',
            timeEstimate: '12 min',
            confidence: 0.75, // Slightly lower confidence since we're inferring it's a draft
            run: async () => {
              await api.bringWindowToFront(recentEditor.handle);
              await closeOverlay();
            },
          });
        }
      }

      // 3b) Finish Google Doc draft (Google Docs doesn't show "unsaved" markers in window titles)
      // Heuristic: if a Google Docs window was active recently, treat it as a draft.
      const recentGoogleDoc = windows
        .filter(looksLikeGoogleDocsWindow)
        .slice()
        .sort((a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime())[0];

      if (recentGoogleDoc) {
        const lastActiveMs = new Date(recentGoogleDoc.last_active).getTime();
        const ageMs = nowMs - lastActiveMs;
        // If user was in Google Docs in the last 20 minutes, it's a good "continue writing" candidate.
        if (ageMs >= 0 && ageMs <= 20 * 60 * 1000) {
          candidates.push({
            id: `finish-google-doc:${recentGoogleDoc.handle}`,
            icon: '📝',
            title: 'Finish document draft (Google Docs)',
            description: recentGoogleDoc.title,
            timeEstimate: '10–15 min',
            confidence: 0.82,
            run: async () => {
              await api.bringWindowToFront(recentGoogleDoc.handle);
              await closeOverlay();
            },
          });
        }
      }

      // 4) Reply to unsent email - use Gmail API to get actual drafts
      console.log('[Do] ========== GMAIL DRAFTS DEBUG ==========');
      console.log('[Do] Gmail drafts from API:', gmailDrafts.length);
      console.log('[Do] Raw gmailDrafts array:', JSON.stringify(gmailDrafts, null, 2));
      
      if (gmailDrafts.length > 0) {
        console.log('[Do] ✓ Gmail drafts found! Details:', gmailDrafts.map((d: any) => ({
          id: d.id,
          snippet: d.snippet,
          hasMessage: !!d.message,
          messageId: d.message?.id,
          hasPayload: !!d.message?.payload,
          hasHeaders: !!d.message?.payload?.headers,
          headersCount: d.message?.payload?.headers?.length || 0
        })));
      } else {
        console.log('[Do] ⚠ No Gmail drafts found. Check terminal for [Gmail] logs.');
      }
      console.log('[Do] ========================================');
      
      // Add each Gmail draft as a separate action
      for (const gmailDraft of gmailDrafts) {
        // Extract email details from draft
        const headers = gmailDraft.message?.payload?.headers || [];
        const to = headers.find((h: any) => h.name?.toLowerCase() === 'to')?.value || 'Unknown recipient';
        const subject = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || 'No subject';
        const snippet = gmailDraft.snippet || gmailDraft.message?.snippet || '';
        
        candidates.push({
          id: `reply-gmail-draft:${gmailDraft.id}`,
          icon: '📧',
          title: `Send unsent email (Gmail)`,
          description: subject || snippet || 'Gmail draft',
          timeEstimate: '5–10 min',
          confidence: 0.9, // High confidence since it's from Gmail API
          run: async () => {
            try {
              // Get full draft details
              const fullDraft = await api.getGmailDraft(gmailDraft.id);
              
              // Extract email details
              const draftHeaders = fullDraft.message?.payload?.headers || [];
              const rawToHeader = draftHeaders.find((h: any) => h.name?.toLowerCase() === 'to')?.value || to;
              const draftSubject = draftHeaders.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || subject;
              
              console.log('[Do] Raw To header:', rawToHeader);
              
              // Clean and validate the "To" email address
              // Gmail headers can contain: "Name <email@example.com>" or just "email@example.com"
              // We need to extract just the email address
              let draftTo = cleanEmailAddress(rawToHeader);
              
              console.log('[Do] Cleaned email address:', draftTo);
              
              // Check if email is missing or invalid
              if (!draftTo || draftTo === 'Unknown recipient' || !isValidEmail(draftTo)) {
                const errorMsg = draftTo === 'Unknown recipient' || !draftTo
                  ? 'This draft has no recipient. Please add a recipient in Gmail before sending.'
                  : `Invalid email address: "${draftTo}". Please check the draft's recipient.`;
                console.error('[Do]', errorMsg);
                setError(errorMsg);
                return; // Don't throw, just show error and return
              }
              
              // Extract body from draft
              let draftBody = '';
              if (fullDraft.message?.payload?.body?.data) {
                try {
                  // Decode base64url body (Gmail API uses base64url encoding)
                  const base64Data = fullDraft.message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
                  const decoded = atob(base64Data);
                  draftBody = decoded;
                } catch (e) {
                  console.error('[Do] Failed to decode draft body:', e);
                  draftBody = snippet || 'Email body';
                }
              } else if (fullDraft.message?.payload?.parts) {
                // Try to get body from parts
                for (const part of fullDraft.message.payload.parts) {
                  if (part.mime_type === 'text/html' || part.mime_type === 'text/plain') {
                    if (part.body?.data) {
                      try {
                        const base64Data = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
                        const decoded = atob(base64Data);
                        draftBody = decoded;
                        break;
                      } catch (e) {
                        console.error('[Do] Failed to decode part body:', e);
                      }
                    }
                  }
                }
              }
              
              if (!draftBody) {
                draftBody = snippet || 'Email body';
              }
              
              // Send the email
              console.log('[Do] Sending email:', { to: draftTo, subject: draftSubject });
              await api.sendGmailEmail(draftTo, draftSubject, draftBody);
              console.log('[Do] ✓ Email sent successfully');
              
              // Delete the draft after sending
              try {
                console.log('[Do] Deleting draft:', gmailDraft.id);
                await api.deleteGmailDraft(gmailDraft.id);
                console.log('[Do] ✓ Draft deleted successfully');
              } catch (deleteError) {
                console.error('[Do] Error deleting draft:', deleteError);
                // Don't fail the whole operation if draft deletion fails
              }
              
              // Refresh actions to remove the sent draft from the list
              // Use setTimeout to avoid calling refresh during buildActions execution
              console.log('[Do] Scheduling refresh to update draft list...');
              setTimeout(() => {
                if (refreshRef.current) {
                  refreshRef.current().catch(console.error);
                }
              }, 100);
              
              // Show success message
              setSuccessMessage('Email sent successfully!');
              setTimeout(() => setSuccessMessage(null), 3000);
            } catch (error) {
              console.error('[Do] Error sending email:', error);
              
              // Show error toast
              const errorMessage = error instanceof Error ? error.message : String(error);
              // Clean up error message for display
              let displayMessage = errorMessage;
              if (errorMessage.includes('Invalid email address')) {
                displayMessage = 'Invalid email address. Please check the draft\'s recipient.';
              } else if (errorMessage.includes('Gmail API error')) {
                // Extract a cleaner error message
                const match = errorMessage.match(/Gmail API error: \d+ - (.+)/);
                if (match) {
                  displayMessage = `Failed to send email: ${match[1]}`;
                }
              }
              // Set error message
              setError(displayMessage);
            }
          },
        });
      }

      // 5) Upload notes - always show general upload button
      candidates.push({
        id: 'upload-notes:general',
        icon: '⬆',
        title: 'Upload notes',
        description: 'Upload handwritten notes to LetMeSell',
        confidence: 0.85,
        run: async () => {
          try {
            // Create a file input element
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.md,.txt,.doc,.docx,.rtf,.pdf,.jpg,.jpeg,.png,.gif,.bmp';
            input.style.display = 'none';
            
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) {
                setUploadingFile(null);
                setUploadProgress(0);
                return;
              }
              
              try {
                console.log('[Do] Uploading selected file to LetMeSell:', file.name);
                setUploadingFile(file.name);
                setUploadProgress(0);
                
                // Read file as array buffer
                const arrayBuffer = await file.arrayBuffer();
                const fileBytes = new Uint8Array(arrayBuffer);
                
                // Simulate progress
                const progressInterval = setInterval(() => {
                  setUploadProgress((prev) => {
                    if (prev >= 90) {
                      clearInterval(progressInterval);
                      return prev;
                    }
                    return prev + 10;
                  });
                }, 200);
                
                const result = await api.uploadFileBytesToLetMeSell(fileBytes, file.name, file.type || undefined);
                
                clearInterval(progressInterval);
                setUploadProgress(100);
                
                if (result.success) {
                  setSuccessMessage(result.message || 'Notes uploaded successfully to LetMeSell!');
                  setTimeout(() => {
                    setSuccessMessage(null);
                    setUploadingFile(null);
                    setUploadProgress(0);
                  }, 3000);
                } else {
                  throw new Error(result.message || 'Upload failed');
                }
              } catch (error) {
                console.error('[Do] Error uploading notes:', error);
                setError(`Failed to upload notes: ${error instanceof Error ? error.message : String(error)}`);
                setUploadingFile(null);
                setUploadProgress(0);
              }
            };
            
            document.body.appendChild(input);
            input.click();
            // Clean up after a delay to allow file selection
            setTimeout(() => {
              if (document.body.contains(input)) {
                document.body.removeChild(input);
              }
            }, 1000);
          } catch (error) {
            console.error('[Do] Error opening file picker:', error);
            setError(`Failed to open file picker: ${error instanceof Error ? error.message : String(error)}`);
          }
        },
      });

      // 6) View uploaded documents
      candidates.push({
        id: 'view-documents:general',
        icon: '📄',
        title: 'View uploaded documents',
        description: 'Open LetMeSell documents viewer',
        confidence: 0.85,
        run: async () => {
          try {
            // Navigate to documents screen inside the app
            const store = useOverlayStore.getState();
            store.setCurrentScreen('documents');
          } catch (error) {
            console.error('[Do] Error navigating to documents:', error);
            setError(`Failed to open documents viewer: ${error instanceof Error ? error.message : String(error)}`);
          }
        },
      });

      // Keep only high-confidence suggestions
      const HIGH_CONFIDENCE_THRESHOLD = 0.75;
      const high = candidates.filter((a) => a.confidence >= HIGH_CONFIDENCE_THRESHOLD);
      
      // Always include upload notes and view documents if available (even if below threshold)
      const uploadNotesAction = candidates.find(a => a.id.startsWith('upload-notes:'));
      const viewDocumentsAction = candidates.find(a => a.id.startsWith('view-documents:'));
      
      if (uploadNotesAction && !high.some(a => a.id === uploadNotesAction.id)) {
        high.push(uploadNotesAction);
      }
      if (viewDocumentsAction && !high.some(a => a.id === viewDocumentsAction.id)) {
        high.push(viewDocumentsAction);
      }

      // Prefer 3–5, but never show low-confidence junk.
      // Always include upload and view documents actions at the top
      const importantActions = high.filter(a => 
        a.id.startsWith('upload-notes:') || a.id.startsWith('view-documents:')
      );
      const otherActions = high.filter(a => 
        !a.id.startsWith('upload-notes:') && !a.id.startsWith('view-documents:')
      );
      
      // Sort other actions by confidence
      otherActions.sort((a, b) => b.confidence - a.confidence);
      
      // Combine: important actions first, then others (limit to 6 total)
      const top = [...importantActions, ...otherActions].slice(0, 6);

      return top;
    },
    [closeOverlay, setActiveMeeting]
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[Do] Refreshing actions...');

      const [windows, recentFiles, allEvents, nextMeeting, secondsUntil, gmailDrafts] = await Promise.all([
        api.getWindowsInfo().catch((err) => {
          console.error('[Do] Error fetching windows:', err);
          return [] as WindowInfo[];
        }),
        api.getRecentFiles().catch(() => [] as RecentFile[]),
        api.getCalendarEvents().catch(() => [] as CalendarEvent[]),
        api.getNextMeeting().catch(() => null as CalendarEvent | null),
        api.timeUntilNextMeeting().catch(() => null as number | null),
        api.getGmailDrafts().then((drafts) => {
          console.log('[Do] ✓ Gmail drafts fetched successfully:', drafts.length);
          return drafts;
        }).catch((err) => {
          const errorStr = err?.toString() || String(err) || JSON.stringify(err);
          console.error('[Do] ✗ Gmail drafts error:', errorStr);
          console.error('[Do] Error type:', typeof err);
          console.error('[Do] Full error object:', err);
          
          // Show error to user if it's an authentication issue
          if (errorStr.includes('authentication') || 
              errorStr.includes('401') || 
              errorStr.includes('403') || 
              errorStr.includes('Failed to get OAuth token') || 
              errorStr.includes('not authenticated') ||
              errorStr.includes('Please re-authenticate')) {
            console.error('[Do] ⚠ Gmail authentication required. Please re-authenticate with Gmail scopes.');
            // Set error state to show user
            setError('Gmail authentication required. Please re-authenticate to access drafts.');
          } else {
            console.warn('[Do] Gmail drafts not available (may not be authenticated or no drafts exist)');
          }
          return [] as any[];
        }),
      ]);

      console.log('[Do] Fetched data:', {
        windows: windows.length,
        recentFiles: recentFiles.length,
        allEvents: allEvents.length,
        nextMeeting: nextMeeting?.title || 'none',
        secondsUntil,
        gmailDrafts: gmailDrafts.length
      });

      setSecondsToNextMeeting(secondsUntil);

      const next = await buildActions(windows, recentFiles, nextMeeting, secondsUntil, gmailDrafts, allEvents);
      console.log('[Do] Built actions:', next.length, next.map(a => a.title));
      setActions(next);
      setSelectedIndex((prev) => clamp(prev, 0, Math.max(0, next.length - 1)));
    } catch (e: any) {
      console.error('[Do] Error in refresh:', e);
      setError(e?.message || 'Failed to load suggestions');
      setActions([]);
      setSelectedIndex(0);
    } finally {
      setLoading(false);
    }
  }, [buildActions]);

  // Store refresh in ref to avoid circular dependency
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  // Listen for meeting open events from Calendar component
  useEffect(() => {
    const handleOpenMeeting = async (event: CustomEvent) => {
      const { url, title } = event.detail;
      console.log('[Do] Received openMeeting event:', { url, title });
      
      // Open meeting in a new Tauri window (not iframe) - this works with Google Meet
      const urlToOpen = url || 'https://meet.google.com/new';
      console.log('[Do] Opening meeting in Tauri window from Calendar:', urlToOpen);
      
      try {
        await api.openMeetingWindow(urlToOpen, title || 'Meeting');
        setSuccessMessage('Meeting opened in new window');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error) {
        console.error('[Do] Failed to open meeting window:', error);
        // Fallback: try iframe approach
        setMeetingLoadError(false);
        setMeetingJoined(false);
        setActiveMeeting({
          url: urlToOpen,
          title: title || 'Meeting'
        });
      }
    };

    window.addEventListener('openMeeting', handleOpenMeeting as EventListener);
    return () => {
      window.removeEventListener('openMeeting', handleOpenMeeting as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isOverlayVisible) return;
    refresh();
    // Refresh every 1 minute (60000ms)
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [isOverlayVisible, refresh]);

  // Keyboard navigation via the global overlay-navigate event (Arrow Up/Down + Enter)
  useEffect(() => {
    if (!isOverlayVisible) return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ direction: 'up' | 'down' | 'left' | 'right' | 'enter' }>;
      const direction = ce?.detail?.direction;
      if (!direction) return;
      if (actions.length === 0) return;

      if (direction === 'up') {
        setSelectedIndex((prev) => (prev <= 0 ? actions.length - 1 : prev - 1));
      } else if (direction === 'down') {
        setSelectedIndex((prev) => (prev >= actions.length - 1 ? 0 : prev + 1));
      } else if (direction === 'enter') {
        const action = actions[selectedIndex];
        if (action) {
          action.run().catch(console.error);
        }
      }
    };

    window.addEventListener('overlay-navigate', handler as EventListener);
    return () => window.removeEventListener('overlay-navigate', handler as EventListener);
  }, [actions, isOverlayVisible, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el && listRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedIndex]);

  const headerSubtitle = useMemo(() => {
    if (typeof secondsToNextMeeting === 'number' && secondsToNextMeeting > 0 && secondsToNextMeeting <= 60 * 60) {
      return `Next meeting in ${formatMinutes(secondsToNextMeeting)}`;
    }
    return 'High-confidence actions you can do right now';
  }, [secondsToNextMeeting]);

  // If meeting is active, show meeting view
  if (activeMeeting) {
    return (
      <div className="screen do-screen" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        width: '100%',
        background: '#000',
        padding: 0
      }}>
        {/* Meeting header */}
        <div style={{
          padding: '1rem',
          background: 'var(--bg-secondary, #1e1e1e)',
          borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
              📞 {activeMeeting.title}
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Meeting in progress
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                window.open(activeMeeting.url, '_blank');
              }}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                color: '#93c5fd',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
              title="Open in browser"
            >
              🌐 Browser
            </button>
            <button
              onClick={() => setActiveMeeting(null)}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Leave Meeting
            </button>
          </div>
        </div>

        {/* Meeting iframe */}
        <div style={{ flex: 1, position: 'relative', background: '#000' }}>
          {!meetingJoined ? (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--text-primary)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📞</div>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Ready to join?
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                {activeMeeting.title}
              </div>
              <button
                onClick={() => {
                  setMeetingJoined(true);
                  setMeetingLoadError(false);
                }}
                style={{
                  padding: '1rem 2rem',
                  background: 'var(--accent, #3b82f6)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2563eb';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent, #3b82f6)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                🚀 Join Meeting
              </button>
              <div style={{ marginTop: '1.5rem' }}>
                <button
                  onClick={() => {
                    window.open(activeMeeting.url, '_blank');
                    setActiveMeeting(null);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'transparent',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '6px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Open in Browser instead
                </button>
              </div>
            </div>
          ) : meetingLoadError ? (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--text-primary)'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
              <div style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Meeting couldn't load in app
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Some meeting platforms require opening in a browser
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    window.open(activeMeeting.url, '_blank');
                    setActiveMeeting(null);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--accent, #3b82f6)',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Open in Browser
                </button>
                <button
                  onClick={() => setActiveMeeting(null)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(107, 114, 128, 0.2)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <iframe
              src={activeMeeting.url}
              style={{
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              allowFullScreen
              onError={() => {
                console.error('[Do] Meeting iframe failed to load');
                // Automatically open in browser when iframe fails
                setTimeout(() => {
                  window.open(activeMeeting.url, '_blank');
                  setActiveMeeting(null);
                }, 500);
              }}
              onLoad={(e) => {
                console.log('[Do] Meeting iframe loaded');
                setMeetingLoadError(false);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen do-screen">
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">Do</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{headerSubtitle}</span>
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#fca5a5',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '6px',
              color: '#6ee7b7',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            ✓ {successMessage}
          </div>
        )}

        {uploadingFile && (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '6px',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                ⬆ Uploading: {uploadingFile}
              </div>
            </div>
            <div style={{
              width: '100%',
              height: '4px',
              background: 'rgba(59, 130, 246, 0.2)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                background: 'var(--accent, #3b82f6)',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {uploadProgress}% complete
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="loading-text">Generating actions...</div>
          </div>
        ) : actions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-title">No high-confidence actions</div>
            <div className="empty-state-description">
              Actions show up automatically when we detect something actionable, for example:
              upcoming meeting to join/prepare, an unsaved draft window, an email draft window, or a recently-edited note.
            </div>
          </div>
        ) : (
          <div className="do-actions" ref={listRef}>
            {actions.map((action, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={action.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  className={`do-item ${isSelected ? 'selected' : ''} ${executingActionId === action.id ? 'executing' : ''}`}
                  role="button"
                  tabIndex={-1}
                  onClick={async () => {
                    // Prevent multiple clicks while executing
                    if (executingActionId === action.id) {
                      return;
                    }
                    try {
                      console.log('[Do] Executing action:', action.title);
                      // Set executing state for this action
                      setExecutingActionId(action.id);
                      await action.run();
                      console.log('[Do] Action completed successfully');
                    } catch (error) {
                      console.error('[Do] Action failed:', error);
                      setError(`Failed to execute: ${error instanceof Error ? error.message : String(error)}`);
                    } finally {
                      // Clear executing state
                      setExecutingActionId(null);
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  aria-label={action.title}
                  style={{
                    opacity: executingActionId === action.id ? 0.7 : 1,
                    cursor: executingActionId === action.id ? 'wait' : 'pointer',
                  }}
                >
                  <div className="window-item-icon">
                    {executingActionId === action.id ? '⏳' : action.icon}
                  </div>
                  <div className="window-item-content">
                    <div className="window-item-title">
                      {executingActionId === action.id ? `Sending email...` : action.title}
                    </div>
                    {action.description && executingActionId !== action.id && (
                      <div className="window-item-subtitle">{action.description}</div>
                    )}
                    {executingActionId === action.id && (
                      <div className="window-item-subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        Please wait...
                      </div>
                    )}
                  </div>
                  <div className="window-item-meta">
                    {executingActionId !== action.id && action.timeEstimate && (
                      <span className="window-item-time">{action.timeEstimate}</span>
                    )}
                    {executingActionId === action.id && (
                      <span className="window-item-time" style={{ color: 'var(--accent)' }}>
                        Sending...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Calendar (kept from previous Do screen) */}
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">Calendar</h3>
        </div>
        <CalendarEvents />
      </div>
    </div>
  );
};
