import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { SplashScreen } from '../common/SplashScreen';
import './../../styles/screens.css';
import './../../styles/design-system.css';

interface AppInfo {
  name: string;
  path: string;
  icon?: string;
  description?: string;
}

export const Launch: React.FC = () => {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [launchingApp, setLaunchingApp] = useState<string | null>(null);

  // Load installed apps on mount
  useEffect(() => {
    loadApps();
  }, []);

  // Filter apps based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredApps(apps);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredApps(
        apps.filter(
          (app) =>
            app.name.toLowerCase().includes(query) ||
            app.path.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, apps]);

  const loadApps = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const installedApps = await api.getInstalledApps(true); // Filter system apps
      setApps(installedApps);
      setFilteredApps(installedApps);
    } catch (err: any) {
      setError(err?.message || 'Failed to load apps');
      console.error('Error loading apps:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchApp = async (app: AppInfo) => {
    if (launchingApp) return; // Prevent multiple launches
    
    try {
      setLaunchingApp(app.name);
      setError(null);
      
      // Show splash screen for at least 500ms for better UX
      const launchPromise = api.launchApp(app.name); // Use name, backend will find the path
      const minDisplayPromise = new Promise(resolve => setTimeout(resolve, 500));
      
      await Promise.all([launchPromise, minDisplayPromise]);
      
      console.log(`[Launch] Launched: ${app.name}`);
      
      // Keep splash visible a bit longer for smooth transition
      setTimeout(() => setLaunchingApp(null), 300);
    } catch (err: any) {
      setError(err?.message || `Failed to launch ${app.name}`);
      console.error('Error launching app:', err);
      setLaunchingApp(null);
    }
  };

  // Also support launching by typing app name and pressing Enter
  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim() && filteredApps.length > 0) {
      // Launch first matching app
      await handleLaunchApp(filteredApps[0]);
    } else if (e.key === 'Enter' && searchQuery.trim() && filteredApps.length === 0) {
      // Try launching by name directly
      try {
        setLaunchingApp(searchQuery);
        setError(null);
        const launchPromise = api.launchApp(searchQuery);
        const minDisplayPromise = new Promise(resolve => setTimeout(resolve, 500));
        await Promise.all([launchPromise, minDisplayPromise]);
        setSearchQuery('');
        setTimeout(() => setLaunchingApp(null), 300);
      } catch (err: any) {
        setError(err?.message || `Failed to launch ${searchQuery}`);
        setLaunchingApp(null);
      }
    }
  };

  const handleLaunchFile = async () => {
    // TODO: Implement file picker
    alert('File picker coming soon!');
  };

  const handleOpenFolder = async () => {
    // TODO: Implement folder picker
    alert('Folder picker coming soon!');
  };

  const handleLaunchUrl = async () => {
    const url = prompt('Enter URL to open:');
    if (url) {
      try {
        await api.launchUrl(url);
      } catch (err: any) {
        setError(err?.message || 'Failed to launch URL');
      }
    }
  };

  return (
    <>
      <SplashScreen appName={launchingApp || ''} isVisible={!!launchingApp} />
      <div className="screen launch-screen">
        <div className="screen-header">
          <h2 className="screen-title">🚀 Launch</h2>
          <p className="screen-subtitle">Launch applications, files, folders, and URLs</p>
        </div>

      {error && (
        <div
          style={{
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            marginBottom: '1rem',
            color: '#fca5a5',
            fontSize: '0.875rem'
          }}
        >
          {error}
        </div>
      )}

      {/* Quick Actions */}
      <div className="section" style={{ marginBottom: '2rem' }}>
        <div className="section-header">
          <h3 className="section-title">Quick Actions</h3>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem'
          }}
        >
          <button
            onClick={handleLaunchFile}
            className="button button-secondary"
            style={{
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <div style={{ fontSize: '2rem' }}>📄</div>
            <div style={{ fontWeight: 600 }}>Launch File</div>
          </button>
          <button
            onClick={handleOpenFolder}
            className="button button-secondary"
            style={{
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <div style={{ fontSize: '2rem' }}>📁</div>
            <div style={{ fontWeight: 600 }}>Open Folder</div>
          </button>
          <button
            onClick={handleLaunchUrl}
            className="button button-secondary"
            style={{
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <div style={{ fontSize: '2rem' }}>🌐</div>
            <div style={{ fontWeight: 600 }}>Launch URL</div>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="section" style={{ marginBottom: '2rem' }}>
        <div className="section-header">
          <h3 className="section-title">Applications</h3>
          <button
            onClick={loadApps}
            className="button button-secondary"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <input
          type="text"
          placeholder="Search applications or type app name and press Enter..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '1rem',
            marginBottom: '1rem'
          }}
          autoFocus
        />
      </div>

      {/* Apps List */}
      <div className="section">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Loading applications...
          </div>
        ) : filteredApps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            {searchQuery ? 'No applications found' : 'No applications available'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem'
            }}
          >
            {filteredApps.map((app, index) => (
              <button
                key={`${app.path}-${index}`}
                onClick={() => handleLaunchApp(app)}
                className="button button-primary"
                disabled={launchingApp === app.name}
                style={{
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  minHeight: '100px',
                  opacity: launchingApp === app.name ? 0.6 : 1,
                  cursor: launchingApp === app.name ? 'wait' : 'pointer'
                }}
              >
                {app.icon ? (
                  <img src={app.icon} alt={app.name} style={{ width: '32px', height: '32px' }} />
                ) : (
                  <div style={{ fontSize: '2rem' }}>📱</div>
                )}
                <div style={{ fontWeight: 600, textAlign: 'center' }}>{app.name}</div>
                {launchingApp === app.name && (
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Launching...</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

