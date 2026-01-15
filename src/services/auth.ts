// Authentication service for desktop app
// Backend API: http://localhost:3000

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface User {
  id: string;
  email: string;
  name: string;
  subscriptionStatus: 'free' | 'pro' | 'enterprise';
}

export interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
  message?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  magicLinkUrl?: string; // Magic link URL for development/testing
}

class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Request magic link for login
   */
  async requestMagicLink(email: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send magic link');
      }

      return data;
    } catch (error) {
      console.error('[Auth] Request magic link error:', error);
      throw error;
    }
  }

  /**
   * Verify magic link token (for manual token entry)
   */
  async verifyToken(token: string, email: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid or expired token');
      }

      return data;
    } catch (error) {
      console.error('[Auth] Verify token error:', error);
      throw error;
    }
  }

  /**
   * Get current user profile (requires token)
   */
  async getCurrentUser(token: string): Promise<User> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get user profile');
      }

      return data.user;
    } catch (error) {
      console.error('[Auth] Get current user error:', error);
      throw error;
    }
  }

  /**
   * Update user profile (requires token)
   */
  async updateProfile(token: string, updates: { name?: string }): Promise<User> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      return data.user;
    } catch (error) {
      console.error('[Auth] Update profile error:', error);
      throw error;
    }
  }

  /**
   * Check if token is valid by fetching user profile
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      await this.getCurrentUser(token);
      return true;
    } catch (error) {
      // If it's a connection error, don't treat it as invalid token
      // The user might just need to start the server
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.warn('[Auth] Server connection error - server may not be running');
        return false; // Still return false, but don't crash
      }
      return false;
    }
  }
  
  /**
   * Check if server is available
   */
  async checkServerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export convenience functions
export const auth = {
  requestMagicLink: (email: string) => authService.requestMagicLink(email),
  verifyToken: (token: string, email: string) => authService.verifyToken(token, email),
  getCurrentUser: (token: string) => authService.getCurrentUser(token),
  updateProfile: (token: string, updates: { name?: string }) => authService.updateProfile(token, updates),
  validateToken: (token: string) => authService.validateToken(token),
};
