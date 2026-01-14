import { invoke } from '@tauri-apps/api/core';

// Window Info type (matches Rust WindowInfo)
export interface WindowInfo {
  handle: number;
  title: string;
  process_name: string;
  executable_path: string;
  last_active: string; // ISO 8601 datetime string
  is_visible: boolean;
}

// Recent File type (matches Rust RecentFile)
export interface RecentFile {
  name: string;
  path: string;
  last_accessed: string; // ISO 8601 datetime string
  file_type: string;
}

// Window type (simplified, matches Rust Window)
export interface Window {
  id: string;
  title: string;
  process_name: string;
  icon?: string;
}

// Backend API client for Tauri commands
export const api = {
  // Window operations - Phase 2.3
  getWindows: async (): Promise<Window[]> => {
    return invoke<Window[]>('get_windows');
  },

  getWindowsInfo: async (): Promise<WindowInfo[]> => {
    return invoke<WindowInfo[]>('get_windows_info');
  },

  getVisibleWindows: async (): Promise<WindowInfo[]> => {
    return invoke<WindowInfo[]>('get_visible_windows');
  },

  getActiveWindow: async (): Promise<WindowInfo | null> => {
    return invoke<WindowInfo | null>('get_active_window');
  },

  getWindowTitles: async (): Promise<string[]> => {
    return invoke<string[]>('get_window_titles');
  },

  getProcessNames: async (): Promise<string[]> => {
    return invoke<string[]>('get_process_names');
  },

  bringWindowToFront: async (handle: number): Promise<void> => {
    return invoke('bring_window_to_front', { handle });
  },

  // Shortcut operations
  registerShortcut: async (shortcut: string) => {
    return invoke('register_shortcut', { shortcut });
  },

  // Overlay operations
  showOverlay: async () => {
    return invoke('show_overlay');
  },

  hideOverlay: async () => {
    return invoke('hide_overlay');
  },

  // File operations - Phase 2.4
  getRecentFiles: async (): Promise<RecentFile[]> => {
    return invoke<RecentFile[]>('get_recent_files');
  },

  getRecentFilesByType: async (fileType: string): Promise<RecentFile[]> => {
    return invoke<RecentFile[]>('get_recent_files_by_type', { file_type: fileType });
  },

  refreshRecentFiles: async (): Promise<RecentFile[]> => {
    return invoke<RecentFile[]>('refresh_recent_files');
  },

  // Calendar operations
  getCalendarEvents: async () => {
    return invoke<any[]>('get_calendar_events');
  },

  getNextMeeting: async () => {
    return invoke<any | null>('get_next_meeting');
  },

  timeUntilNextMeeting: async () => {
    return invoke<number | null>('time_until_next_meeting');
  },

  refreshCalendarEvents: async () => {
    return invoke('refresh_calendar_events');
  },

  // Gmail operations
  getGmailDrafts: async (): Promise<any[]> => {
    return invoke('get_gmail_drafts');
  },

  getGmailDraft: async (draftId: string): Promise<any> => {
    return invoke('get_gmail_draft', { draftId });
  },

  sendGmailEmail: async (to: string, subject: string, body: string, replyToMessageId?: string, threadId?: string): Promise<any> => {
    return invoke('send_gmail_email', { to, subject, body, replyToMessageId, threadId });
  },

  replyToGmailEmail: async (messageId: string, to: string, subject: string, body: string): Promise<any> => {
    return invoke('reply_to_gmail_email', { messageId, to, subject, body });
  },

  deleteGmailDraft: async (draftId: string): Promise<void> => {
    return invoke('delete_gmail_draft', { draftId });
  },

  getGoogleAuthUrl: async () => {
    return invoke<string>('get_google_auth_url');
  },

  startGoogleOAuthFlow: async () => {
    return invoke('start_google_oauth_flow');
  },

  handleOAuthCallback: async (provider: string, code: string) => {
    return invoke('handle_oauth_callback', { provider, code });
  },

  isCalendarAuthenticated: async () => {
    return invoke<boolean>('is_calendar_authenticated');
  },

  // Focus operations
  startFocusMode: async (modeStr: string, customMinutes?: number) => {
    return invoke('start_focus_mode', { modeStr, customMinutes });
  },

  stopFocusMode: async () => {
    return invoke('stop_focus_mode');
  },

  getCurrentFocusSession: async () => {
    return invoke<any | null>('get_current_focus_session');
  },

  getFocusRemainingSeconds: async () => {
    return invoke<number | null>('get_focus_remaining_seconds');
  },

  isFocusActive: async () => {
    return invoke<boolean>('is_focus_active');
  },

  getMeetingSuggestions: async () => {
    return invoke<any[]>('get_meeting_suggestions');
  },

  openFocusAssistSettings: async () => {
    return invoke('open_focus_assist_settings');
  },

  temporarilyMuteNotifications: async (durationMinutes?: number) => {
    return invoke('temporarily_mute_notifications', { durationMinutes });
  },

  unmuteNotifications: async () => {
    return invoke('unmute_notifications');
  },

  getTemporaryMuteRemaining: async () => {
    return invoke<number | null>('get_temporary_mute_remaining');
  },

  isNotificationsMuted: async () => {
    return invoke<boolean>('is_notifications_muted');
  },

  // Launch operations
  launchApp: async (nameOrPath: string) => {
    return invoke('launch_app', { nameOrPath });
  },

  launchFile: async (filePath: string) => {
    return invoke('launch_file', { filePath });
  },

  openFolder: async (folderPath: string) => {
    return invoke('open_folder', { folderPath });
  },

  launchUrl: async (url: string) => {
    return invoke('launch_url', { url });
  },

  openMeetingWindow: async (url: string, title: string) => {
    return invoke('open_meeting_window', { url, title });
  },

  uploadFileToLetMeSell: async (filePath: string) => {
    return invoke<{ success: boolean; message: string; url?: string }>('upload_file_to_letmesell', { filePath });
  },

  uploadFileBytesToLetMeSell: async (fileBytes: Uint8Array, fileName: string, mimeType?: string) => {
    return invoke<{ success: boolean; message: string; url?: string }>('upload_file_bytes_to_letmesell', { 
      fileBytes: Array.from(fileBytes),
      fileName,
      mimeType 
    });
  },

  pickNoteFiles: async () => {
    return invoke<string[]>('pick_note_files');
  },

  openDocumentsViewer: async () => {
    return invoke('open_documents_viewer');
  },

  getUploadedDocuments: async () => {
    return invoke<any[]>('get_uploaded_documents');
  },

  openDocument: async (documentUrl: string, title: string) => {
    return invoke('open_document', { documentUrl, title });
  },

  getInstalledApps: async (filterSystem?: boolean) => {
    return invoke<AppInfo[]>('get_installed_apps', { filterSystem });
  },
};

// AppInfo type for launch operations
export interface AppInfo {
  name: string;
  path: string;
  icon?: string;
  description?: string;
}

