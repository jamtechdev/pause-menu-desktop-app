// API service for LetMeSell Web
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export interface User {
  id: string;
  email: string;
  name: string;
  subscriptionStatus: 'free' | 'pro' | 'enterprise';
}

export interface CheckoutResponse {
  success: boolean;
  sessionId: string;
  url: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Request magic link for login
   */
  async requestMagicLink(email: string): Promise<{ success: boolean; message: string; magicLinkUrl?: string }> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    return response.json();
  }

  /**
   * Create Stripe checkout session
   * For web flow: email is collected first, then checkout is created
   */
  async createCheckoutSession(
    plan: string = 'pro', 
    email?: string, 
    billingPeriod: 'monthly' | 'yearly' = 'monthly'
  ): Promise<CheckoutResponse> {
    // First, if email is provided, create account or verify it exists
    if (email) {
      try {
        await this.requestMagicLink(email);
        // Account will be created when user verifies magic link
        // For now, we'll proceed with checkout
      } catch (err) {
        console.error('Error requesting magic link:', err);
        // Continue anyway - account will be created during checkout
      }
    }

    // Use public checkout endpoint for web flow (no auth required)
    const response = await fetch(`${this.baseUrl}/api/subscription/checkout-public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan, email, billingPeriod }),
    });

    // Check content type before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Server returned HTML or other non-JSON response
      const text = await response.text();
      console.error('[API] Non-JSON response:', text.substring(0, 200));
      throw new Error(`Server error: Received ${response.status} ${response.statusText}. Please check if the backend server is running.`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Failed to create checkout session: ${response.status} ${response.statusText}`);
    }

    return data;
  }

  /**
   * Get Stripe publishable key
   */
  async getPublishableKey(): Promise<{ success: boolean; publishableKey: string }> {
    const response = await fetch(`${this.baseUrl}/api/subscription/publishable-key`);
    return response.json();
  }

  /**
   * Verify magic link token
   */
  async verifyToken(token: string, email: string): Promise<{ success: boolean; user: User; token: string }> {
    const response = await fetch(`${this.baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, email }),
    });

    return response.json();
  }
}

export const apiService = new ApiService();

