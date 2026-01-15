import React, { useState, useEffect } from 'react';
import { subscriptionService, SubscriptionHistoryItem } from '../services/subscription';

interface SubscriptionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export const SubscriptionHistoryModal: React.FC<SubscriptionHistoryModalProps> = ({
  isOpen,
  onClose,
  token,
}) => {
  const [history, setHistory] = useState<SubscriptionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<string | null>(null);
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      loadHistory();
    } else {
      // Cleanup blob URL when modal closes
      if (invoicePdfUrl) {
        URL.revokeObjectURL(invoicePdfUrl);
        setInvoicePdfUrl(null);
      }
      setViewingInvoice(null);
    }
  }, [isOpen, token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (invoicePdfUrl) {
        URL.revokeObjectURL(invoicePdfUrl);
      }
    };
  }, [invoicePdfUrl]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await subscriptionService.getHistory(token);
      setHistory(data);
    } catch (err: any) {
      console.error('[SubscriptionHistoryModal] Load history error:', err);
      setError(err.message || 'Failed to load subscription history');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '900px',
          height: '85%',
          maxHeight: '800px',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#fff',
              margin: 0,
            }}
          >
            Payment History
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '20px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {viewingInvoice ? (
            <>
              {/* Invoice Viewer */}
              <div
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => {
                    setViewingInvoice(null);
                    if (invoicePdfUrl) {
                      URL.revokeObjectURL(invoicePdfUrl);
                      setInvoicePdfUrl(null);
                    }
                  }}
                  style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                  }}
                >
                  ← Back to History
                </button>
                <div
                  style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.7)',
                  }}
                >
                  Invoice
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  background: '#fff',
                  position: 'relative',
                }}
              >
                {loadingInvoice ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: '#666',
                      fontSize: '16px',
                    }}
                  >
                    Loading invoice...
                  </div>
                ) : invoicePdfUrl ? (
                  <iframe
                    src={invoicePdfUrl}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                    }}
                    title="Invoice"
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: '#666',
                      fontSize: '16px',
                      gap: '16px',
                    }}
                  >
                    <div>Unable to load invoice</div>
                    <button
                      onClick={() => {
                        if (viewingInvoice) {
                          window.open(viewingInvoice, '_blank');
                        }
                      }}
                      style={{
                        padding: '10px 20px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Open in Browser
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* History List */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '24px',
                }}
              >
                {loading ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: 'rgba(255, 255, 255, 0.7)',
                    }}
                  >
                    Loading payment history...
                  </div>
                ) : error ? (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      borderRadius: '8px',
                      padding: '16px',
                      color: '#fca5a5',
                      marginBottom: '16px',
                    }}
                  >
                    {error}
                  </div>
                ) : history.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: 'rgba(255, 255, 255, 0.7)',
                    }}
                  >
                    No payment history found.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {history.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          padding: '16px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '8px',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#fff',
                                marginBottom: '4px',
                              }}
                            >
                              {item.description}
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: 'rgba(255, 255, 255, 0.6)',
                              }}
                            >
                              {new Date(item.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                              {item.periodStart && item.periodEnd && (
                                <span style={{ marginLeft: '8px' }}>
                                  • {new Date(item.periodStart).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}{' '}
                                  -{' '}
                                  {new Date(item.periodEnd).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            style={{
                              textAlign: 'right',
                            }}
                          >
                            <div
                              style={{
                                fontSize: '18px',
                                fontWeight: '700',
                                color: item.status === 'paid' ? '#10b981' : '#fca5a5',
                                marginBottom: '4px',
                              }}
                            >
                              {typeof item.amount === 'number' ? `${item.currency} ${item.amount.toFixed(2)}` : item.amount}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: item.status === 'paid' ? '#10b981' : '#fca5a5',
                                textTransform: 'uppercase',
                                fontWeight: '600',
                              }}
                            >
                              {item.status}
                            </div>
                          </div>
                        </div>
                        {(item.invoiceUrl || item.invoicePdf) && (
                          <button
                            onClick={async () => {
                              setLoadingInvoice(true);
                              setError(null);
                              try {
                                // Use invoice ID from the item to fetch via backend proxy
                                const invoiceId = item.id;
                                if (!invoiceId) {
                                  throw new Error('Invoice ID not available');
                                }

                                // Fetch PDF through backend proxy to avoid CORS issues
                                const blob = await subscriptionService.getInvoicePdf(token, invoiceId);
                                const blobUrl = URL.createObjectURL(blob);
                                setInvoicePdfUrl(blobUrl);
                                setViewingInvoice(invoiceId); // Store invoice ID for reference
                              } catch (err: any) {
                                console.error('[SubscriptionHistoryModal] Error loading invoice:', err);
                                setError(err.message || 'Failed to load invoice. Please try again.');
                                setViewingInvoice(null);
                              } finally {
                                setLoadingInvoice(false);
                              }
                            }}
                            disabled={loadingInvoice}
                            style={{
                              marginTop: '8px',
                              padding: '8px 16px',
                              background: 'rgba(99, 102, 241, 0.2)',
                              color: '#a5b4fc',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: loadingInvoice ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              width: '100%',
                              opacity: loadingInvoice ? 0.6 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (!loadingInvoice) {
                                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)';
                                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!loadingInvoice) {
                                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                              }
                            }}
                          >
                            {loadingInvoice ? 'Loading...' : 'View Invoice'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

