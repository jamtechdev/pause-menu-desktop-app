import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, AppInfo } from '../../services/api';
import { useOverlayStore } from '../../stores/overlayStore';
import './../../styles/screens.css';
import './../../styles/design-system.css';

type TabType = 'apps' | 'folders' | 'links';

interface FolderItem {
  name: string;
  path: string;
  icon: string;
}

interface LinkItem {
  name: string;
  url: string;
  icon: string;
  category?: string;
}

// Enhanced popular apps with better matching
const POPULAR_APPS_MAP: Record<string, { icon: string; keywords: string[] }> = {
  'chrome': { icon: '🌐', keywords: ['chrome', 'browser', 'google'] },
  'microsoft edge': { icon: '🌐', keywords: ['edge', 'msedge', 'browser'] },
  'outlook': { icon: '📧', keywords: ['outlook', 'email', 'mail'] },
  'excel': { icon: '📊', keywords: ['excel', 'spreadsheet', 'xlsx'] },
  'powerpoint': { icon: '📽️', keywords: ['powerpoint', 'presentation', 'ppt'] },
  'word': { icon: '📄', keywords: ['word', 'document', 'doc'] },
  'slack': { icon: '💬', keywords: ['slack', 'chat', 'team'] },
  'zoom': { icon: '📹', keywords: ['zoom', 'meeting', 'video'] },
  'code': { icon: '💻', keywords: ['vscode', 'code', 'editor'] },
  'notion': { icon: '📝', keywords: ['notion', 'notes', 'wiki'] },
  'figma': { icon: '🎨', keywords: ['figma', 'design', 'ui'] },
};

// Predefined popular apps
const POPULAR_APPS: Array<{ name: string; icon: string; keywords: string[] }> = [
  { name: 'Chrome', icon: '🌐', keywords: ['chrome', 'browser', 'google'] },
  { name: 'Microsoft Edge', icon: '🌐', keywords: ['edge', 'msedge', 'browser'] },
  { name: 'Outlook', icon: '📧', keywords: ['outlook', 'email', 'mail'] },
  { name: 'Excel', icon: '📊', keywords: ['excel', 'spreadsheet', 'xlsx'] },
  { name: 'PowerPoint', icon: '📽️', keywords: ['powerpoint', 'presentation', 'ppt'] },
  { name: 'Word', icon: '📄', keywords: ['word', 'document', 'doc'] },
  { name: 'Slack', icon: '💬', keywords: ['slack', 'chat', 'team'] },
  { name: 'Zoom', icon: '📹', keywords: ['zoom', 'meeting', 'video'] },
  { name: 'VS Code', icon: '💻', keywords: ['vscode', 'code', 'editor'] },
  { name: 'Notion', icon: '📝', keywords: ['notion', 'notes', 'wiki'] },
  { name: 'Figma', icon: '🎨', keywords: ['figma', 'design', 'ui'] },
];

// Predefined folders - using Windows shell: paths for common folders
const COMMON_FOLDERS: FolderItem[] = [
  { name: 'Desktop', path: 'shell:Desktop', icon: '🖥️' },
  { name: 'Downloads', path: 'shell:Downloads', icon: '⬇️' },
  { name: 'Documents', path: 'shell:Documents', icon: '📁' },
  { name: 'Pictures', path: 'shell:Pictures', icon: '🖼️' },
  { name: 'Videos', path: 'shell:Videos', icon: '🎬' },
  { name: 'Music', path: 'shell:Music', icon: '🎵' },
];

// Predefined links
const COMMON_LINKS: LinkItem[] = [
  { name: 'Google Calendar', url: 'https://calendar.google.com', icon: '📅', category: 'Productivity' },
  { name: 'Gmail', url: 'https://mail.google.com', icon: '📧', category: 'Email' },
  { name: 'Google Drive', url: 'https://drive.google.com', icon: '☁️', category: 'Storage' },
  { name: 'GitHub', url: 'https://github.com', icon: '🔀', category: 'Development' },
  { name: 'Jira', url: 'https://jira.com', icon: '🎯', category: 'Project Management' },
  { name: 'HubSpot', url: 'https://app.hubspot.com', icon: '📈', category: 'CRM' },
  { name: 'Notion', url: 'https://notion.so', icon: '📝', category: 'Productivity' },
  { name: 'Figma', url: 'https://figma.com', icon: '🎨', category: 'Design' },
  { name: 'Slack', url: 'https://slack.com', icon: '💬', category: 'Communication' },
  { name: 'Zoom', url: 'https://zoom.us', icon: '📹', category: 'Video' },
];

// Get app icon helper
const getAppIcon = (appName: string, appInfo?: AppInfo): string => {
  if (appInfo?.icon) return appInfo.icon;
  
  const name = appName.toLowerCase();
  const popularApp = POPULAR_APPS.find(app => 
    app.keywords.some(kw => name.includes(kw.toLowerCase()))
  );
  if (popularApp) return popularApp.icon;
  
  // Fallback to process icon logic
  if (name.includes('chrome') || name.includes('msedge') || name.includes('firefox')) return '🌐';
  if (name.includes('outlook') || name.includes('mail')) return '📧';
  if (name.includes('excel') || name.includes('spreadsheet')) return '📊';
  if (name.includes('powerpoint') || name.includes('presentation')) return '📽️';
  if (name.includes('word') || name.includes('document')) return '📄';
  if (name.includes('slack')) return '💬';
  if (name.includes('zoom')) return '📹';
  if (name.includes('code') || name.includes('vscode')) return '💻';
  if (name.includes('notion')) return '📝';
  if (name.includes('figma')) return '🎨';
  
  return '📱';
};

export const Jump: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('apps');
  const [searchQuery, setSearchQuery] = useState('');
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [launchingItem, setLaunchingItem] = useState<string | null>(null);
  
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isOverlayVisible = useOverlayStore((s) => s.isOverlayVisible);

  // Combine popular apps with installed apps
  const allApps = React.useMemo(() => {
    const popularAppNames = new Set(POPULAR_APPS.map(app => app.name.toLowerCase()));
    const installedAppNames = new Set(apps.map(app => app.name.toLowerCase()));
    
    // Add popular apps that aren't in installed list
    const popularOnly = POPULAR_APPS
      .filter(app => !installedAppNames.has(app.name.toLowerCase()))
      .map(app => ({
        name: app.name,
        path: app.name, // Use name as path for popular apps
        icon: app.icon,
        description: undefined,
      }));
    
    // Combine: installed apps first, then popular apps
    return [...apps, ...popularOnly];
  }, [apps]);

  // Filter items based on search query - enhanced with better matching
  const filteredApps = React.useMemo(() => {
    if (!searchQuery.trim()) return allApps;
    const query = searchQuery.toLowerCase().trim();
    const queryWords = query.split(/\s+/);
    
    return allApps.filter(app => {
      const name = app.name.toLowerCase();
      const path = app.path?.toLowerCase() || '';
      const desc = app.description?.toLowerCase() || '';
      
      // Check if all query words match
      return queryWords.every(word => 
        name.includes(word) || 
        path.includes(word) || 
        desc.includes(word)
      );
    }).sort((a, b) => {
      // Sort by relevance: exact name match first, then starts with, then contains
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      if (aName === query) return -1;
      if (bName === query) return 1;
      if (aName.startsWith(query)) return -1;
      if (bName.startsWith(query)) return 1;
      return 0;
    });
  }, [allApps, searchQuery]);

  const filteredFolders = React.useMemo(() => {
    if (!searchQuery.trim()) return COMMON_FOLDERS;
    const query = searchQuery.toLowerCase().trim();
    const queryWords = query.split(/\s+/);
    
    return COMMON_FOLDERS.filter(folder => {
      const name = folder.name.toLowerCase();
      const path = folder.path.toLowerCase();
      
      return queryWords.every(word => 
        name.includes(word) || 
        path.includes(word)
      );
    }).sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      if (aName === query) return -1;
      if (bName === query) return 1;
      if (aName.startsWith(query)) return -1;
      if (bName.startsWith(query)) return 1;
      return 0;
    });
  }, [searchQuery]);

  const filteredLinks = React.useMemo(() => {
    if (!searchQuery.trim()) return COMMON_LINKS;
    const query = searchQuery.toLowerCase().trim();
    const queryWords = query.split(/\s+/);
    
    return COMMON_LINKS.filter(link => {
      const name = link.name.toLowerCase();
      const url = link.url.toLowerCase();
      const category = link.category?.toLowerCase() || '';
      
      return queryWords.every(word => 
        name.includes(word) || 
        url.includes(word) || 
        category.includes(word)
      );
    }).sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      if (aName === query) return -1;
      if (bName === query) return 1;
      if (aName.startsWith(query)) return -1;
      if (bName.startsWith(query)) return 1;
      return 0;
    });
  }, [searchQuery]);

  // Get current filtered items based on active tab
  const currentItems = React.useMemo(() => {
    switch (activeTab) {
      case 'apps': return filteredApps;
      case 'folders': return filteredFolders;
      case 'links': return filteredLinks;
      default: return [];
    }
  }, [activeTab, filteredApps, filteredFolders, filteredLinks]);

  // Load installed apps
  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const installedApps = await api.getInstalledApps(true); // Filter system apps
      setApps(installedApps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
      console.error('Error loading apps:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'apps') {
      loadApps();
    }
  }, [activeTab, loadApps]);

  // Handle app launch
  const handleLaunchApp = useCallback(async (app: AppInfo | { name: string; path: string }) => {
    try {
      setLaunchingItem(app.name);
      await api.launchApp(app.name);
      // Close overlay after launching
      const store = useOverlayStore.getState();
      store.setOverlayVisible(false);
      await api.hideOverlay();
    } catch (err) {
      console.error('Error launching app:', err);
      setError(`Failed to launch ${app.name}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLaunchingItem(null);
    }
  }, []);

  // Handle folder open
  const handleOpenFolder = useCallback(async (folder: FolderItem) => {
    try {
      setLaunchingItem(folder.name);
      // Use the folder path as-is - the backend will handle path resolution
      // For common folders like "Desktop", "Downloads", etc., the backend should resolve them
      await api.openFolder(folder.path);
      // Close overlay after opening
      const store = useOverlayStore.getState();
      store.setOverlayVisible(false);
      await api.hideOverlay();
    } catch (err) {
      console.error('Error opening folder:', err);
      setError(`Failed to open folder: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLaunchingItem(null);
    }
  }, []);

  // Handle link open
  const handleOpenLink = useCallback(async (link: LinkItem) => {
    try {
      setLaunchingItem(link.name);
      await api.launchUrl(link.url);
      // Close overlay after opening
      const store = useOverlayStore.getState();
      store.setOverlayVisible(false);
      await api.hideOverlay();
    } catch (err) {
      console.error('Error opening link:', err);
      setError(`Failed to open link: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLaunchingItem(null);
    }
  }, []);

  // Handle item click
  const handleItemClick = useCallback((index: number) => {
    const item = currentItems[index];
    if (!item) return;

    if (activeTab === 'apps') {
      handleLaunchApp(item as AppInfo);
    } else if (activeTab === 'folders') {
      handleOpenFolder(item as FolderItem);
    } else if (activeTab === 'links') {
      handleOpenLink(item as LinkItem);
    }
  }, [activeTab, currentItems, handleLaunchApp, handleOpenFolder, handleOpenLink]);

  // Keyboard navigation - only when search input is not focused
  useEffect(() => {
    if (!isOverlayVisible) return;

    let isHandling = false; // Guard to prevent duplicate handling

    const handler = (e: Event) => {
      // Prevent duplicate handling
      if (isHandling) return;
      
      const ce = e as CustomEvent<{ direction: 'up' | 'down' | 'left' | 'right' | 'enter' }>;
      const direction = ce?.detail?.direction;
      if (!direction) return;

      // Don't handle navigation if user is typing in search
      const activeElement = document.activeElement;
      if (activeElement === searchInputRef.current) {
        // Only handle Enter to launch first result
        if (direction === 'enter' && currentItems.length > 0) {
          handleItemClick(0);
        }
        return;
      }

      isHandling = true;
      
      if (direction === 'up') {
        setSelectedIndex((prev) => {
          const newIndex = prev <= 0 ? Math.max(0, currentItems.length - 1) : prev - 1;
          setTimeout(() => { isHandling = false; }, 50);
          return newIndex;
        });
      } else if (direction === 'down') {
        setSelectedIndex((prev) => {
          const newIndex = prev >= currentItems.length - 1 ? 0 : prev + 1;
          setTimeout(() => { isHandling = false; }, 50);
          return newIndex;
        });
      } else if (direction === 'enter') {
        if (selectedIndex >= 0 && selectedIndex < currentItems.length) {
          handleItemClick(selectedIndex);
        }
        setTimeout(() => { isHandling = false; }, 50);
      } else {
        isHandling = false;
      }
    };

    window.addEventListener('overlay-navigate', handler as EventListener);
    return () => window.removeEventListener('overlay-navigate', handler as EventListener);
  }, [isOverlayVisible, currentItems, selectedIndex, handleItemClick]);

  // Reset selected index when tab or search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeTab, searchQuery]);

  // Scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el && listRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedIndex]);

  // Focus search on mount
  useEffect(() => {
    if (isOverlayVisible && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOverlayVisible, activeTab]);

  // Stop keyboard events from bubbling to global handlers when typing in search
  useEffect(() => {
    if (!searchInputRef.current) return;
    
    const input = searchInputRef.current;
    
    // Only stop propagation for navigation keys, not all keys
    // This allows normal typing to work while preventing global handlers from interfering
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only stop propagation for navigation keys that might interfere
      // Allow all other keys (letters, numbers, etc.) to work normally
      const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'];
      
      // If it's a navigation key and the input is focused, stop it from reaching global handlers
      // BUT only if it's not a key that should work in the input (like Escape to clear)
      if (navigationKeys.includes(e.key) && document.activeElement === input) {
        // For Escape, let it work in the input's own handler
        if (e.key === 'Escape') {
          return; // Let the input handle Escape
        }
        // For arrows when there's no search query, let them work
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !searchQuery.trim()) {
          return; // Let the input handle it
        }
        // Otherwise, stop propagation to prevent global handler interference
        e.stopPropagation();
      }
    };
    
    // Add listener to input directly, not in capture phase
    // This way the input handles the event first, then we stop it from bubbling
    input.addEventListener('keydown', handleKeyDown, false);
    
    return () => {
      input.removeEventListener('keydown', handleKeyDown, false);
    };
  }, [searchQuery]);

  const renderContent = () => {
    if (loading && currentItems.length === 0) {
      return (
        <div className="loading-container">
          <div className="loading-text">Loading...</div>
        </div>
      );
    }

    if (error && currentItems.length === 0) {
      return (
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
        </div>
      );
    }

    if (currentItems.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No results found</div>
          <div className="empty-state-description">
            {searchQuery ? `No ${activeTab} match "${searchQuery}"` : `No ${activeTab} available`}
          </div>
        </div>
      );
    }

    return (
      <div 
        className="jump-list" 
        ref={listRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {currentItems.map((item, index) => {
          const isSelected = index === selectedIndex;
          const isLaunching = launchingItem === (item as any).name;

          if (activeTab === 'apps') {
            const app = item as AppInfo;
            return (
              <div
                key={`${app.path}-${index}`}
                ref={(el) => { itemRefs.current[index] = el; }}
                role="button"
                tabIndex={-1}
                onClick={() => handleItemClick(index)}
                onMouseEnter={(e) => {
                  setSelectedIndex(index);
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  }
                }}
                style={{
                  padding: '14px 16px',
                  background: isSelected 
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.08))' 
                    : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '8px',
                  cursor: isLaunching ? 'wait' : 'pointer',
                  opacity: isLaunching ? 0.6 : 1,
                  transition: 'all 150ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transform: isSelected ? 'translateX(2px)' : 'none',
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
              >
                <div style={{
                  fontSize: '24px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  opacity: 0.9,
                }}>
                  {getAppIcon(app.name, app)}
                </div>
                <div style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#fff',
                    lineHeight: 1.4,
                  }}>
                    {app.name}
                  </div>
                  {app.description && !isLaunching && (
                    <div style={{
                      fontSize: '12px',
                      color: '#888',
                      lineHeight: 1.3,
                    }}>
                      {app.description}
                    </div>
                  )}
                  {isLaunching && (
                    <div style={{
                      fontSize: '12px',
                      color: '#3b82f6',
                      lineHeight: 1.3,
                      fontWeight: 500,
                    }}>
                      Launching...
                    </div>
                  )}
                </div>
              </div>
            );
          } else if (activeTab === 'folders') {
            const folder = item as FolderItem;
            return (
              <div
                key={`${folder.path}-${index}`}
                ref={(el) => { itemRefs.current[index] = el; }}
                role="button"
                tabIndex={-1}
                onClick={() => handleItemClick(index)}
                onMouseEnter={(e) => {
                  setSelectedIndex(index);
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  }
                }}
                style={{
                  padding: '14px 16px',
                  background: isSelected 
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.08))' 
                    : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '8px',
                  cursor: isLaunching ? 'wait' : 'pointer',
                  opacity: isLaunching ? 0.6 : 1,
                  transition: 'all 150ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transform: isSelected ? 'translateX(2px)' : 'none',
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
              >
                <div style={{
                  fontSize: '24px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  opacity: 0.9,
                }}>
                  {folder.icon}
                </div>
                <div style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#fff',
                    lineHeight: 1.4,
                  }}>
                    {folder.name}
                  </div>
                  {!isLaunching && (
                    <div style={{
                      fontSize: '12px',
                      color: '#888',
                      lineHeight: 1.3,
                      fontFamily: 'monospace',
                    }}>
                      {folder.path}
                    </div>
                  )}
                  {isLaunching && (
                    <div style={{
                      fontSize: '12px',
                      color: '#3b82f6',
                      lineHeight: 1.3,
                      fontWeight: 500,
                    }}>
                      Opening...
                    </div>
                  )}
                </div>
              </div>
            );
          } else {
            const link = item as LinkItem;
            return (
              <div
                key={`${link.url}-${index}`}
                ref={(el) => { itemRefs.current[index] = el; }}
                role="button"
                tabIndex={-1}
                onClick={() => handleItemClick(index)}
                onMouseEnter={(e) => {
                  setSelectedIndex(index);
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  }
                }}
                style={{
                  padding: '14px 16px',
                  background: isSelected 
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.08))' 
                    : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '8px',
                  cursor: isLaunching ? 'wait' : 'pointer',
                  opacity: isLaunching ? 0.6 : 1,
                  transition: 'all 150ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transform: isSelected ? 'translateX(2px)' : 'none',
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
              >
                <div style={{
                  fontSize: '24px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  opacity: 0.9,
                }}>
                  {link.icon}
                </div>
                <div style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#fff',
                    lineHeight: 1.4,
                  }}>
                    {link.name}
                  </div>
                  {!isLaunching && (
                    <div style={{
                      fontSize: '12px',
                      color: '#888',
                      lineHeight: 1.3,
                    }}>
                      {link.category && (
                        <span style={{
                          background: 'rgba(59, 130, 246, 0.15)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          marginRight: '8px',
                          fontSize: '10px',
                          fontWeight: 500,
                        }}>
                          {link.category}
                        </span>
                      )}
                      <span style={{ fontFamily: 'monospace' }}>{link.url}</span>
                    </div>
                  )}
                  {isLaunching && (
                    <div style={{
                      fontSize: '12px',
                      color: '#3b82f6',
                      lineHeight: 1.3,
                      fontWeight: 500,
                    }}>
                      Opening...
                    </div>
                  )}
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="screen jump-screen" style={{ padding: '24px' }}>
      <div className="section">
        {/* Header */}
        <div className="section-header" style={{ marginBottom: '20px' }}>
          <div>
            <h3 className="section-title" style={{ fontSize: '13px', marginBottom: '4px' }}>↗ Jump</h3>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: 400 }}>
              Quick navigation to apps, folders, and links
            </span>
          </div>
        </div>

        {/* Simple Search Box - No complex handlers */}
        <div style={{ 
          marginBottom: '20px',
          position: 'relative',
          pointerEvents: 'auto'
        }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={`Search ${activeTab === 'apps' ? 'applications' : activeTab === 'folders' ? 'folders' : 'links'}...`}
            value={searchQuery}
            readOnly={false}
            disabled={false}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onInput={(e) => {
              // Fallback handler to ensure input works even if onChange doesn't fire
              const target = e.target as HTMLInputElement;
              if (target.value !== searchQuery) {
                console.log('[Jump] onInput fired - value changed from', searchQuery, 'to', target.value);
                setSearchQuery(target.value);
                setSelectedIndex(0);
              }
            }}
            onKeyDown={(e) => {
              // ONLY handle special keys, let everything else work normally
              if (e.key === 'Enter' && currentItems.length > 0) {
                e.preventDefault();
                handleItemClick(selectedIndex >= 0 ? selectedIndex : 0);
              } else if (e.key === 'Escape' && searchQuery) {
                e.preventDefault();
                setSearchQuery('');
              } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !searchQuery.trim()) {
                e.preventDefault();
                searchInputRef.current?.blur();
              }
              // For ALL other keys, do NOTHING - let them work normally
            }}
            onMouseDown={(e) => {
              // Ensure input can receive focus when clicked
              e.currentTarget.focus();
            }}
            style={{
              width: '100%',
              padding: '12px 16px 12px 44px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 150ms ease',
              fontFamily: 'inherit',
              pointerEvents: 'auto',
              cursor: 'text',
            }}
            onFocus={(e) => {
              e.target.select();
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }}
          />
          <span style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '16px',
            opacity: 0.6,
            pointerEvents: 'none',
          }}>🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'all 120ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#888';
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Enhanced Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <button
            onClick={() => {
              setActiveTab('apps');
              setSearchQuery('');
              setSelectedIndex(0);
            }}
            style={{
              padding: '8px 16px',
              background: activeTab === 'apps' 
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))' 
                : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${activeTab === 'apps' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '6px',
              color: activeTab === 'apps' ? '#fff' : '#aaa',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === 'apps' ? '600' : '500',
              transition: 'all 150ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'apps') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'apps') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
          >
            <span>📱</span>
            <span>Apps</span>
            {filteredApps.length > 0 && (
              <span style={{
                background: activeTab === 'apps' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: '600',
              }}>
                {filteredApps.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('folders');
              setSearchQuery('');
              setSelectedIndex(0);
            }}
            style={{
              padding: '8px 16px',
              background: activeTab === 'folders' 
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))' 
                : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${activeTab === 'folders' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '6px',
              color: activeTab === 'folders' ? '#fff' : '#aaa',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === 'folders' ? '600' : '500',
              transition: 'all 150ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'folders') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'folders') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
          >
            <span>📁</span>
            <span>Folders</span>
            {filteredFolders.length > 0 && (
              <span style={{
                background: activeTab === 'folders' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: '600',
              }}>
                {filteredFolders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('links');
              setSearchQuery('');
              setSelectedIndex(0);
            }}
            style={{
              padding: '8px 16px',
              background: activeTab === 'links' 
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))' 
                : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${activeTab === 'links' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '6px',
              color: activeTab === 'links' ? '#fff' : '#aaa',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === 'links' ? '600' : '500',
              transition: 'all 150ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'links') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'links') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
          >
            <span>🔗</span>
            <span>Links</span>
            {filteredLinks.length > 0 && (
              <span style={{
                background: activeTab === 'links' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: '600',
              }}>
                {filteredLinks.length}
              </span>
            )}
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {renderContent()}
      </div>
    </div>
  );
};
