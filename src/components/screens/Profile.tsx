import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { subscriptionService, SubscriptionHistoryItem } from '../../services/subscription';
import { Subscription } from '../../services/subscription';
import { authService } from '../../services/auth';
import { SubscriptionHistoryModal } from '../SubscriptionHistoryModal';

export const Profile: React.FC = () => {
  const { user, token, logout, setUser } = useAuthStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSubscription();
  }, [token]);

  // Auto-refresh subscription every 30 seconds when on Profile screen
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      loadSubscription();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    // Update name value when user changes
    if (user?.name) {
      setNameValue(user.name);
    }
  }, [user?.name]);

  // Prevent scrolling when Profile screen is active
  useEffect(() => {
    const bodyElement = document.querySelector('.command-center-body');
    if (bodyElement) {
      bodyElement.classList.add('no-scrollbar');
      // Add inline styles to prevent scrolling
      (bodyElement as HTMLElement).style.overflow = 'hidden';
      (bodyElement as HTMLElement).style.overflowY = 'hidden';
      (bodyElement as HTMLElement).style.scrollbarWidth = 'none';
      (bodyElement as HTMLElement).style.msOverflowStyle = 'none';
    }

    return () => {
      // Cleanup: remove class and restore styles when component unmounts
      const bodyElement = document.querySelector('.command-center-body');
      if (bodyElement) {
        bodyElement.classList.remove('no-scrollbar');
        (bodyElement as HTMLElement).style.overflow = '';
        (bodyElement as HTMLElement).style.overflowY = '';
        (bodyElement as HTMLElement).style.scrollbarWidth = '';
        (bodyElement as HTMLElement).style.msOverflowStyle = '';
      }
    };
  }, []);

  const loadSubscription = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const sub = await subscriptionService.getSubscription(token);
      setSubscription(sub);
    } catch (err: any) {
      console.error('[Profile] Load subscription error:', err);
      setError(err.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const syncSubscription = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const sub = await subscriptionService.syncSubscription(token);
      setSubscription(sub);
      // Also refresh user data to get updated subscription status
      const user = await authService.getCurrentUser(token);
      if (user) {
        setUser(user);
      }
    } catch (err: any) {
      console.error('[Profile] Sync subscription error:', err);
      setError(err.message || 'Failed to sync subscription');
    } finally {
      setLoading(false);
    }
  };


  const handleUpgrade = async () => {
    if (!token) return;

    try {
      setUpgrading(true);
      const checkout = await subscriptionService.createCheckout(token, 'pro');
      
      if (checkout.url) {
        // Open Stripe checkout in browser
        await open(checkout.url);
        // Reload subscription after a delay (user might complete checkout)
        setTimeout(() => {
          loadSubscription();
        }, 3000);
      }
    } catch (err: any) {
      console.error('[Profile] Upgrade error:', err);
      setError(err.message || 'Failed to create checkout session');
    } finally {
      setUpgrading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      window.location.reload();
    }
  };

  const handleStartEditName = () => {
    setIsEditingName(true);
    setNameValue(user?.name || '');
    setNameError(null);
    // Focus the input after a small delay to ensure it's rendered
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 50);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setNameValue(user?.name || '');
    setNameError(null);
  };

  const handleSaveName = async () => {
    if (!token) return;

    const trimmedName = nameValue.trim();
    
    if (!trimmedName) {
      setNameError('Name cannot be empty');
      return;
    }

    if (trimmedName === user?.name) {
      // No change, just cancel
      handleCancelEditName();
      return;
    }

    try {
      setSavingName(true);
      setNameError(null);
      
      const updatedUser = await authService.updateProfile(token, { name: trimmedName });
      
      // Update auth store with new user data
      setUser(updatedUser);
      
      setIsEditingName(false);
      setError(null);
    } catch (err: any) {
      console.error('[Profile] Update name error:', err);
      setNameError(err.message || 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const getPlanDisplayName = (plan: string) => {
    switch (plan) {
      case 'pro':
        return 'Pro';
      case 'enterprise':
        return 'Enterprise';
      default:
        return 'Free';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'pro':
        return '#3b82f6';
      case 'enterprise':
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={{
      padding: '20px 40px',
      maxWidth: '800px',
      margin: '0 auto',
      color: '#fff',
      height: '100%',
      maxHeight: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      // Hide scrollbar
      scrollbarWidth: 'none', // Firefox
      msOverflowStyle: 'none', // IE and Edge
    } as React.CSSProperties}>
      <style>{`
        /* Prevent scrolling for Profile page */
        .command-center-body.no-scrollbar {
          overflow: hidden !important;
          overflow-y: hidden !important;
          scrollbar-width: none !important; /* Firefox */
          -ms-overflow-style: none !important; /* IE and Edge */
        }
        .command-center-body.no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
      `}</style>
      <h1 style={{
        fontSize: '28px',
        fontWeight: '700',
        marginBottom: '16px',
        color: '#fff',
        flexShrink: 0,
      }}>
        Account & Subscription
      </h1>

      {/* User Info Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '16px',
        backdropFilter: 'blur(10px)',
        flexShrink: 0,
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '600',
          marginBottom: '16px',
          color: '#fff',
        }}>
          User Information
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '4px',
            }}>
              Name
            </div>
            {isEditingName ? (
              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px',
                  pointerEvents: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameValue}
                  onChange={(e) => {
                    setNameValue(e.target.value);
                    setNameError(null);
                  }}
                  onKeyDown={(e) => {
                    // Stop propagation for Enter and Escape to prevent global handlers from interfering
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      handleSaveName();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      handleCancelEditName();
                    } else {
                      // For all other keys (typing), stop propagation to prevent global handlers
                      // but don't prevent default so typing works normally
                      e.stopPropagation();
                    }
                  }}
                  onInput={(e) => {
                    // Fallback handler to ensure input works even if onChange doesn't fire
                    const target = e.target as HTMLInputElement;
                    if (target.value !== nameValue) {
                      setNameValue(target.value);
                      setNameError(null);
                    }
                  }}
                  onClick={(e) => {
                    // Ensure input can receive focus when clicked
                    e.stopPropagation();
                    e.currentTarget.focus();
                  }}
                  onMouseDown={(e) => {
                    // Ensure input can receive focus when clicked
                    e.stopPropagation();
                  }}
                  autoFocus
                  disabled={savingName}
                  readOnly={false}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: nameError ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    fontSize: '16px',
                    color: '#fff',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    pointerEvents: 'auto',
                    width: '100%',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    e.stopPropagation();
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }}
                />
                {nameError && (
                  <div style={{
                    fontSize: '12px',
                    color: '#fca5a5',
                  }}>
                    {nameError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    style={{
                      padding: '6px 16px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: savingName ? 'not-allowed' : 'pointer',
                      opacity: savingName ? 0.6 : 1,
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!savingName) {
                        e.currentTarget.style.background = '#2563eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!savingName) {
                        e.currentTarget.style.background = '#3b82f6';
                      }
                    }}
                  >
                    {savingName ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelEditName}
                    disabled={savingName}
                    style={{
                      padding: '6px 16px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: savingName ? 'not-allowed' : 'pointer',
                      opacity: savingName ? 0.6 : 1,
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!savingName) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!savingName) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      }
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  fontSize: '16px',
                  color: '#fff',
                  fontWeight: '500',
                }}>
                  {user?.name || 'Not set'}
                </div>
                <button
                  onClick={handleStartEditName}
                  style={{
                    padding: '4px 12px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#93c5fd',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          <div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '4px',
            }}>
              Email
            </div>
            <div style={{
              fontSize: '16px',
              color: '#fff',
              fontWeight: '500',
            }}>
              {user?.email}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '4px',
            }}>
              Account Status
            </div>
            <div style={{
              fontSize: '16px',
              color: '#10b981',
              fontWeight: '500',
            }}>
              Active
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '16px',
        backdropFilter: 'blur(10px)',
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        maxHeight: '100%',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            margin: 0,
            color: '#fff',
          }}>
            Subscription
          </h2>
          <button
            onClick={syncSubscription}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
              }
            }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {loading ? (
          <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Loading subscription...</div>
        ) : error ? (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '8px',
            padding: '12px',
            color: '#fca5a5',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        ) : subscription ? (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '20px',
            }}>
              <div style={{
                background: getPlanColor(subscription.plan),
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '18px',
                fontWeight: '700',
                color: '#fff',
              }}>
                {getPlanDisplayName(subscription.plan)}
              </div>
              
              <div style={{
                background: subscription.active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                border: `1px solid ${subscription.active ? '#10b981' : '#6b7280'}`,
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '14px',
                fontWeight: '600',
                color: subscription.active ? '#10b981' : '#9ca3af',
              }}>
                {subscription.active ? 'Active' : 'Inactive'}
              </div>
            </div>

            {subscription.currentPeriodEnd && (
              <div style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '16px',
              }}>
                {subscription.cancelAtPeriodEnd 
                  ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                  : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                }
              </div>
            )}

            {/* Features */}
            <div style={{
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'auto',
              flex: 1,
              minHeight: 0,
              // Hide scrollbar
              scrollbarWidth: 'none', // Firefox
              msOverflowStyle: 'none', // IE and Edge
            } as React.CSSProperties}>
              <style>{`
                /* Hide scrollbar in features section */
                div[style*="overflow: auto"]::-webkit-scrollbar {
                  display: none !important;
                }
              `}</style>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#fff',
                marginBottom: '12px',
              }}>
                Features:
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
              }}>
                {Object.entries(subscription.features).map(([key, value]) => (
                  <div key={key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.8)',
                  }}>
                    <span style={{
                      color: value === true || value === -1 ? '#10b981' : '#6b7280',
                      fontSize: '16px',
                    }}>
                      {value === true || value === -1 ? '✓' : '✗'}
                    </span>
                    <span style={{
                      textTransform: 'capitalize',
                      textDecoration: value === false ? 'line-through' : 'none',
                      opacity: value === false ? 0.5 : 1,
                    }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upgrade Button */}
            {!subscription.active || subscription.plan === 'free' ? (
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                style={{
                  marginTop: '20px',
                  width: '100%',
                  padding: '14px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: upgrading ? 'not-allowed' : 'pointer',
                  opacity: upgrading ? 0.6 : 1,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!upgrading) {
                    e.currentTarget.style.background = '#2563eb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!upgrading) {
                    e.currentTarget.style.background = '#3b82f6';
                  }
                }}
              >
                {upgrading ? 'Processing...' : 'Upgrade to Pro'}
              </button>
            ) : null}
          </>
        ) : (
          <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            No subscription found. You're on the Free plan.
          </div>
        )}
      </div>

      {/* View Payment History Button */}
      {subscription && subscription.plan !== 'free' && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          backdropFilter: 'blur(10px)',
        }}>
          <button
            onClick={() => setShowHistoryModal(true)}
            style={{
              width: '100%',
              padding: '14px',
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              fontSize: '16px',
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
            📄 View Payment History
          </button>
        </div>
      )}

      {/* Subscription History Modal */}
      {token && (
        <SubscriptionHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          token={token}
        />
      )}

      {/* Logout Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: 'auto',
        flexShrink: 0,
      }}>
        <button
          onClick={handleLogout}
          style={{
            padding: '12px 24px',
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#fca5a5',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

