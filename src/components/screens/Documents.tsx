import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import './../../styles/screens.css';
import './../../styles/design-system.css';

interface Document {
  filename: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  url: string;
  viewUrl?: string;
  mimeType?: string;
}

export const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showBlankWarning, setShowBlankWarning] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await api.getUploadedDocuments();
      setDocuments(docs as Document[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    // Refresh every 5 seconds
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  const handleViewDocument = (doc: Document) => {
    setViewingDocument(doc);
    setIframeError(false);
    setIframeLoaded(false);
    setShowBlankWarning(false);
    
    // Check if file is likely viewable before showing
    const mimeType = doc.mimeType || '';
    const originalName = doc.originalName || doc.filename || '';
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    
    // List of file types that CANNOT be viewed in browser
    const nonViewableTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    
    const nonViewableExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf'];
    
    // List of file types/extensions that CAN be viewed
    const viewableExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'txt', 'md', 'html', 'htm', 'svg', 'csv', 'json', 'xml'];
    const viewableMimeTypes = [
      'application/pdf',
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml',
      'text/plain', 'text/markdown', 'text/html', 'text/csv',
      'application/json', 'application/xml', 'text/xml'
    ];
    
    // If it's a known non-viewable type, show warning immediately
    if (nonViewableTypes.includes(mimeType) || nonViewableExts.includes(ext)) {
      console.log('[Documents] File type not viewable (known non-viewable type), showing warning immediately');
      setShowBlankWarning(true);
      setIframeError(true);
      return;
    }
    
    // If it has a viewable extension OR viewable MIME type, allow it to try loading
    // Only block if it's explicitly octet-stream AND has no viewable extension
    if (mimeType === 'application/octet-stream' && !viewableExts.includes(ext)) {
      console.log('[Documents] File type is octet-stream with no viewable extension, showing warning');
      setShowBlankWarning(true);
      setIframeError(true);
      return;
    }
    
    // If no MIME type and no extension, show warning
    if (!mimeType && !ext) {
      console.log('[Documents] No MIME type and no extension, showing warning');
      setShowBlankWarning(true);
      setIframeError(true);
      return;
    }
    
    // Otherwise, allow it to try loading in iframe
    console.log('[Documents] File appears viewable, attempting to load in iframe', { mimeType, ext, originalName });
    
    // For potentially viewable files, try to load in iframe but set timeout to detect blank
    setTimeout(() => {
      if (!iframeLoaded && !iframeError) {
        console.log('[Documents] Iframe did not load within timeout, showing warning');
        setShowBlankWarning(true);
        setIframeError(true);
      }
    }, 2000); // 2 seconds
  };

  const handleCloseViewer = () => {
    setViewingDocument(null);
    setIframeError(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getDocumentViewUrl = (doc: Document): string => {
    return doc.viewUrl || `http://localhost:3000${doc.url}`;
  };


  return (
    <div className="screen documents-screen" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {viewingDocument ? (
        // Document viewer view
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          {/* Viewer header */}
          <div style={{
            padding: '1rem',
            background: 'var(--bg-secondary, #1e1e1e)',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                📄 {viewingDocument.originalName || viewingDocument.filename}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {formatFileSize(viewingDocument.size)} • Uploaded {formatDate(viewingDocument.uploadedAt)}
              </div>
            </div>
            <button
              onClick={handleCloseViewer}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(107, 114, 128, 0.2)',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                marginLeft: '1rem',
              }}
            >
              ← Back to List
            </button>
          </div>

          {/* Document viewer */}
          <div style={{ flex: 1, position: 'relative', background: '#1a1a1a', overflow: 'hidden' }}>
            {!iframeError && !showBlankWarning && viewingDocument ? (
              <>
                <iframe
                  key={viewingDocument.filename} // Force re-render when document changes
                  src={getDocumentViewUrl(viewingDocument)}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: '#fff',
                  }}
                  title={viewingDocument.originalName || viewingDocument.filename}
                  onLoad={() => {
                    console.log('[Documents] Iframe loaded successfully');
                    setIframeError(false);
                    setIframeLoaded(true);
                    
                    // Check if iframe content is actually visible after a short delay
                    setTimeout(() => {
                      try {
                        const iframe = document.querySelector('iframe[title="' + (viewingDocument.originalName || viewingDocument.filename) + '"]') as HTMLIFrameElement;
                        if (iframe && iframe.contentWindow) {
                          // Try to check if content is blank
                          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                          if (iframeDoc) {
                            const bodyText = iframeDoc.body?.innerText?.trim() || '';
                            const hasImages = iframeDoc.querySelectorAll('img')?.length || 0;
                            const hasContent = bodyText.length > 0 || hasImages > 0;
                            
                            // Also check if it's showing a download prompt or error
                            const pageText = iframeDoc.documentElement?.innerText?.toLowerCase() || '';
                            const isDownloadPage = pageText.includes('download') || pageText.includes('cannot display');
                            
                            if ((!hasContent && iframeDoc.body) || isDownloadPage) {
                              // Iframe loaded but appears blank or is a download page
                              console.log('[Documents] Iframe appears to be blank or unviewable');
                              setShowBlankWarning(true);
                              setIframeError(true);
                            }
                          }
                        }
                      } catch (e) {
                        // Cross-origin or other error - assume it might be blank
                        console.log('[Documents] Cannot check iframe content (may be cross-origin), showing warning');
                        // If we can't check, show warning after a delay if MIME type suggests it's not viewable
                        const mimeType = viewingDocument.mimeType || '';
                        if (mimeType === 'application/octet-stream' || !mimeType) {
                          setTimeout(() => {
                            setShowBlankWarning(true);
                            setIframeError(true);
                          }, 1000);
                        }
                      }
                    }, 1500);
                  }}
                  onError={() => {
                    console.log('[Documents] Iframe failed to load document');
                    setIframeError(true);
                  }}
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              </>
            ) : (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                padding: '2rem',
                color: 'var(--text-primary)',
                maxWidth: '500px',
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
                <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  {showBlankWarning ? 'File cannot be previewed' : 'Unable to preview file'}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  {showBlankWarning 
                    ? 'This file type cannot be displayed in the browser. It may be a binary file (like Word, Excel, or other document formats) that requires a specific application to open.'
                    : 'This file type may not be viewable in the browser'}
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setIframeError(false);
                      setShowBlankWarning(false);
                      setIframeLoaded(false);
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(107, 114, 128, 0.2)',
                      border: '1px solid rgba(107, 114, 128, 0.3)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => {
                      const url = getDocumentViewUrl(viewingDocument);
                      window.open(url, '_blank');
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'var(--accent, #3b82f6)',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    Open in Browser
                  </button>
                </div>
              </div>
            )}
            {/* Show warning overlay if iframe is blank */}
            {iframeLoaded && showBlankWarning && (
              <div style={{
                position: 'absolute',
                bottom: '1rem',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '1rem 1.5rem',
                background: 'rgba(239, 68, 68, 0.9)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.875rem',
                maxWidth: '90%',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              }}>
                ⚠️ This file cannot be previewed in the browser. Click "Open in Browser" to download or open with your default application.
              </div>
            )}
          </div>
        </div>
      ) : (
        // Documents list view
        <div className="section" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="section-header">
            <h3 className="section-title">📄 Uploaded Documents</h3>
            <button
              onClick={fetchDocuments}
              className="refresh-btn"
              title="Refresh"
              disabled={loading}
              style={{
                padding: '0.5rem',
                background: 'transparent',
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                fontSize: '1.25rem',
              }}
            >
              {loading ? '⏳' : '🔄'}
            </button>
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

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && documents.length === 0 ? (
              <div className="loading-container">
                <div className="loading-text">Loading documents...</div>
              </div>
            ) : documents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📄</div>
                <div className="empty-state-title">No documents uploaded yet</div>
                <div className="empty-state-description">
                  Upload files from the Do screen to see them here
                </div>
              </div>
            ) : (
              <div className="documents-list">
                {documents.map((doc, index) => (
                  <div key={doc.filename || index} className="window-item">
                    <div className="window-item-icon">📄</div>
                    <div className="window-item-content">
                      <div className="window-item-title">{doc.originalName || doc.filename}</div>
                      <div className="window-item-subtitle">
                        {formatFileSize(doc.size)} • Uploaded {formatDate(doc.uploadedAt)}
                      </div>
                    </div>
                    <div className="window-item-meta">
                      <button
                        onClick={() => handleViewDocument(doc)}
                        className="action-btn"
                        title="View document"
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'rgba(59, 130, 246, 0.2)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '6px',
                          color: '#93c5fd',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

