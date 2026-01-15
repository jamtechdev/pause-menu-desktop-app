// Subscription service for desktop app
// Backend API: http://localhost:3000

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Subscription {
  status: 'free' | 'pro' | 'enterprise';
  plan: 'free' | 'pro' | 'enterprise';
  active: boolean;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  features: {
    maxDocuments: number;
    maxStorageMB: number;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    teamCollaboration: boolean;
  };
}

export interface CheckoutResponse {
  success: boolean;
  sessionId: string;
  url: string;
  message?: string;
}

export interface SubscriptionHistoryItem {
  id: string;
  type: 'subscription' | 'one-time';
  status: string;
  amount: number;
  currency: string;
  date: string;
  periodStart: string | null;
  periodEnd: string | null;
  plan: string;
  description: string;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  billingReason: string;
}

class SubscriptionService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Get subscription status (requires token)
   */
  async getSubscription(token: string): Promise<Subscription | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/subscription/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get subscription status');
      }

      return data.subscription;
    } catch (error) {
      console.error('[Subscription] Get subscription error:', error);
      return null;
    }
  }

  /**
   * Create checkout session (requires token)
   */
  async createCheckout(
    token: string, 
    plan: 'pro' | 'enterprise' = 'pro',
    billingPeriod: 'monthly' | 'yearly' = 'monthly'
  ): Promise<CheckoutResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/subscription/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan, billingPeriod }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session');
      }

      return data;
    } catch (error) {
      console.error('[Subscription] Create checkout error:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription (requires token)
   */
  async cancelSubscription(token: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('[Subscription] Cancel subscription error:', error);
      throw error;
    }
  }

  /**
   * Get Stripe publishable key
   */
  async getPublishableKey(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/subscription/publishable-key`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.publishableKey) {
        return data.publishableKey;
      }

      return null;
    } catch (error) {
      console.error('[Subscription] Get publishable key error:', error);
      return null;
    }
  }

  /**
   * Check if user has access to a specific feature
   */
  async checkFeatureAccess(token: string, feature: string): Promise<boolean> {
    try {
      const subscription = await this.getSubscription(token);
      if (!subscription || !subscription.active) {
        return false;
      }

      return subscription.features[feature as keyof typeof subscription.features] === true ||
             subscription.features[feature as keyof typeof subscription.features] === -1;
    } catch (error) {
      console.error('[Subscription] Check feature access error:', error);
      return false;
    }
  }

  /**
   * Get subscription history (invoices and payments)
   */
  async syncSubscription(token: string): Promise<Subscription> {
    try {
      const response = await fetch(`${this.baseUrl}/api/subscription/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to sync subscription');
      }

      return data.subscription;
    } catch (error) {
      console.error('[Subscription] Sync error:', error);
      throw error;
    }
  }

  async getHistory(token: string): Promise<SubscriptionHistoryItem[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/subscription/history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get subscription history');
      }

      return data.history || [];
    } catch (error) {
      console.error('[Subscription] Get history error:', error);
      return [];
    }
  }

  async getInvoicePdf(token: string, invoiceId: string): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseUrl}/api/subscription/invoice/${invoiceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch invoice' }));
        throw new Error(errorData.message || 'Failed to fetch invoice');
      }

      return await response.blob();
    } catch (error) {
      console.error('[Subscription] Get invoice PDF error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();

// Export convenience functions
export const subscription = {
  getSubscription: (token: string) => subscriptionService.getSubscription(token),
  createCheckout: (token: string, plan?: 'pro' | 'enterprise') => subscriptionService.createCheckout(token, plan),
  cancelSubscription: (token: string) => subscriptionService.cancelSubscription(token),
  getPublishableKey: () => subscriptionService.getPublishableKey(),
  checkFeatureAccess: (token: string, feature: string) => subscriptionService.checkFeatureAccess(token, feature),
  getHistory: (token: string) => subscriptionService.getHistory(token),
};
