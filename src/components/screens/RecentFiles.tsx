import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api, RecentFile } from '../../services/api';
import './../../styles/screens.css';
import './../../styles/design-system.css';

export const RecentFiles: React.FC = () => {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'thumbnail' | 'list'>('list');

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const files = await api.getRecentFiles();
      setRecentFiles(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recent files');
      console.error('Error fetching recent files:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFiles();
    const interval = setInterval(refreshFiles, 5000);
    return () => clearInterval(interval);
  }, [refreshFiles]);

  const getFileIcon = useCallback((type: string) => {
    const icons: Record<string, string> = {
      pdf: '📄', doc: '📝', docx: '📝',
      xls: '📊', xlsx: '📊',
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
      mp4: '🎬', avi: '🎬', mov: '🎬',
      mp3: '🎵', wav: '🎵',
      zip: '📦', rar: '📦',
      txt: '📃', md: '📃',
      js: '💻', ts: '💻', py: '💻', java: '💻',
    };
    return icons[type.toLowerCase()] || '📄';
  }, []);

  const cleanFileName = useCallback((name: string) => {
    let cleaned = name.replace(/\s*\(\d+\)(\s*\(\d+\))*\s*$/g, '');
    cleaned = cleaned.replace(/%[0-9A-F]{2}/gi, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned || name;
  }, []);

  // Group files by time period
  const groupedFiles = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const groups: {
      today: RecentFile[];
      yesterday: RecentFile[];
      lastWeek: RecentFile[];
      lastMonth: RecentFile[];
      older: RecentFile[];
    } = {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    };

    recentFiles.forEach(file => {
      const fileDate = new Date(file.last_accessed);
      
      if (fileDate >= today) {
        groups.today.push(file);
      } else if (fileDate >= yesterday) {
        groups.yesterday.push(file);
      } else if (fileDate >= lastWeek) {
        groups.lastWeek.push(file);
      } else if (fileDate >= lastMonth) {
        groups.lastMonth.push(file);
      } else {
        groups.older.push(file);
      }
    });

    return groups;
  }, [recentFiles]);

  const formatDate = useCallback((dateString: string) => {
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
  }, []);

  const renderFileGroup = (title: string, files: RecentFile[]) => {
    if (files.length === 0) return null;

    if (viewMode === 'thumbnail') {
      return (
        <div className="section" key={title}>
          <div className="section-header">
            <h3 className="section-title">{title}</h3>
          </div>
          <div className="files-grid">
            {files.map((file, index) => {
              const cleanName = cleanFileName(file.name);
              return (
                <div key={`${file.path}-${index}`} className="file-item-thumbnail">
                  <div className="file-item-thumbnail-icon">{getFileIcon(file.file_type)}</div>
                  <div className="file-item-content">
                    <div className="file-item-title">{cleanName}</div>
                    <div className="file-item-process">{file.path}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // List view
    return (
      <div className="section" key={title}>
        <div className="section-header">
          <h3 className="section-title">{title}</h3>
        </div>
        <div className="files-list">
          {files.map((file, index) => {
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
      </div>
    );
  };

  return (
    <div className="screen">
      {error && (
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {loading && recentFiles.length === 0 ? (
        <div className="loading-container">
          <div className="loading-text">Loading recent files...</div>
        </div>
      ) : recentFiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <div className="empty-state-title">No recent files</div>
          <div className="empty-state-description">Open some files to see them here</div>
        </div>
      ) : (
        <>
          <div className="section-header">
            <h3 className="section-title">Recent Files</h3>
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
          {renderFileGroup('Today', groupedFiles.today)}
          {renderFileGroup('Yesterday', groupedFiles.yesterday)}
          {renderFileGroup('Last week', groupedFiles.lastWeek)}
          {renderFileGroup('Last month', groupedFiles.lastMonth)}
          {renderFileGroup('Older', groupedFiles.older)}
        </>
      )}
    </div>
  );
};
