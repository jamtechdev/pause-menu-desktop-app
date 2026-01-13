import React, { useState, useEffect, useCallback } from 'react';
import { api, RecentFile, WindowInfo } from '../../services/api';
import { formatTime } from '../../utils/timeUtils';
import './../../styles/screens.css';
import './../../styles/design-system.css';

interface ContinueProps {
  onToggleOverlay?: () => void;
}

export const Continue: React.FC<ContinueProps> = ({ onToggleOverlay }) => {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [activeWindow, setActiveWindow] = useState<WindowInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [files, window] = await Promise.all([
        api.getRecentFiles().catch(() => []),
        api.getActiveWindow().catch(() => null),
      ]);
      setRecentFiles(files.slice(0, 10));
      setActiveWindow(window);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const getFileIcon = (type: string) => {
    const icons: Record<string, string> = {
      pdf: '📄', doc: '📝', docx: '📝',
      xls: '📊', xlsx: '📊',
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
      mp4: '🎬', mp3: '🎵',
      zip: '📦', txt: '📃', md: '📃',
      js: '💻', ts: '💻', py: '💻',
    };
    return icons[type.toLowerCase()] || '📄';
  };

  const cleanFileName = (name: string) => {
    let cleaned = name.replace(/\s*\(\d+\)(\s*\(\d+\))*\s*$/g, '');
    cleaned = cleaned.replace(/%[0-9A-F]{2}/gi, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned || name;
  };

  return (
    <div className="screen">
      {/* Active Window Section */}
      {activeWindow && (
        <div className="section">
          <div className="section-header">
            <h3 className="section-title">Active Window</h3>
          </div>
          <div className="list">
            <div className="list-item">
              <div className="list-item-icon">🪟</div>
              <div className="list-item-content">
                <div className="list-item-title">{activeWindow.title || 'Untitled Window'}</div>
                <div className="list-item-subtitle">{activeWindow.executable_path}</div>
              </div>
              <div className="list-item-meta">
                <span className="list-item-time">{activeWindow.process_name}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Files Section */}
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">Recent Files</h3>
        </div>
        {loading ? (
          <div className="loading-container">
            <div className="loading-text">Loading...</div>
          </div>
        ) : recentFiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <div className="empty-state-title">No recent files</div>
            <div className="empty-state-description">Open some files to see them here</div>
          </div>
        ) : (
          <div className="files-list">
            {recentFiles.map((file, index) => {
              const cleanName = cleanFileName(file.name);
              return (
                <div key={`${file.path}-${index}`} className="file-item">
                  <div className="file-icon">{getFileIcon(file.file_type)}</div>
                  <div className="file-info">
                    <div className="file-name">{cleanName}</div>
                    <div className="file-path">{file.path}</div>
                  </div>
                  <div className="file-meta">
                    <span className="list-item-time">{formatDate(file.last_accessed)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
