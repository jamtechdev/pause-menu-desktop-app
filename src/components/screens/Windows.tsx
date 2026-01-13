import React, { useState, useEffect, useCallback } from 'react';
import { api, WindowInfo, Window } from '../../services/api';
import { getProcessIcon, cleanProcessName, cleanWindowTitle } from '../../utils/windowUtils';
import './../../styles/screens.css';
import './../../styles/design-system.css';

export const Windows: React.FC = () => {
  const [allWindows, setAllWindows] = useState<Window[]>([]);
  const [visibleWindows, setVisibleWindows] = useState<WindowInfo[]>([]);
  const [activeWindow, setActiveWindow] = useState<WindowInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'visible' | 'active'>('all');
  const [viewMode, setViewMode] = useState<'thumbnail' | 'list'>('thumbnail');

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, visible, active] = await Promise.all([
        api.getWindows().catch(() => []),
        api.getVisibleWindows().catch(() => []),
        api.getActiveWindow().catch(() => null),
      ]);

      setAllWindows(all);
      setVisibleWindows(visible);
      setActiveWindow(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch windows');
      console.error('Error fetching windows:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 3000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const renderContent = () => {
    if (loading && allWindows.length === 0) {
      return (
        <div className="loading-container">
          <div className="loading-text">Loading windows...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
        </div>
      );
    }

    const getWindowsToRender = () => {
      switch (activeTab) {
        case 'all':
          return allWindows.map(w => ({ ...w, handle: parseInt(w.id) || 0 }));
        case 'visible':
          return visibleWindows;
        case 'active':
          return activeWindow ? [activeWindow] : [];
        default:
          return [];
      }
    };

    const windows = getWindowsToRender();

    if (activeTab === 'active' && !activeWindow) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">🪟</div>
          <div className="empty-state-title">No active window</div>
          <div className="empty-state-description">No window is currently focused</div>
        </div>
      );
    }

    if (viewMode === 'list') {
      return (
        <div className="windows-list-view">
          {windows.map((window) => (
            <div key={window.handle || window.id} className="window-list-item">
              <div className="window-list-item-icon">{getProcessIcon(window.process_name)}</div>
              <div className="window-list-item-content">
                <div className="window-list-item-title">{cleanWindowTitle(window.title)}</div>
                <div className="window-list-item-subtitle">{cleanProcessName(window.process_name)}</div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Thumbnail view
    return (
      <div className={`windows-grid ${viewMode === 'thumbnail' ? 'windows-grid-thumbnail' : ''}`}>
        {windows.map((window) => (
          <div key={window.handle || window.id} className="window-item window-item-thumbnail">
            <div className="window-item-thumbnail-icon">{getProcessIcon(window.process_name)}</div>
            <div className="window-item-content">
              <div className="window-item-title">{cleanWindowTitle(window.title)}</div>
              <div className="window-item-process">{cleanProcessName(window.process_name)}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="screen">
      <div className="section-header">
        <h3 className="section-title">Windows</h3>
        <div className="section-header-actions">
          <div className="filter-group">
            <button
              className={`filter-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All {allWindows.length > 0 && `(${allWindows.length})`}
            </button>
            <button
              className={`filter-btn ${activeTab === 'visible' ? 'active' : ''}`}
              onClick={() => setActiveTab('visible')}
            >
              Visible {visibleWindows.length > 0 && `(${visibleWindows.length})`}
            </button>
            <button
              className={`filter-btn ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              Active
            </button>
          </div>
          <div className="view-mode-group">
            <button
              className={`view-mode-btn ${viewMode === 'thumbnail' ? 'active' : ''}`}
              onClick={() => setViewMode('thumbnail')}
              title="Thumbnail View"
            >
              <span className="view-mode-icon">⊞</span>
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <span className="view-mode-icon">☰</span>
            </button>
          </div>
        </div>
      </div>

      {renderContent()}
    </div>
  );
};
