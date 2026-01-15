// Authentication service - Magic link authentication

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { UserModel } = require('../models/user');
const emailService = require('./email');
const n8nService = require('./n8n');

// Store magic link tokens (in production, use Redis or database)
const magicLinkTokens = new Map();

class AuthService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.MAGIC_LINK_EXPIRY = 60 * 60 * 1000; // 60 minutes (1 hour)
  }

  /**
   * Generate a magic link token
   */
  generateMagicLinkToken(email) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.MAGIC_LINK_EXPIRY;

    magicLinkTokens.set(token, {
      email: email.toLowerCase(),
      expiresAt,
      createdAt: Date.now(),
    });

    // Clean up expired tokens periodically
    this.cleanupExpiredTokens();

    return token;
  }

  /**
   * Verify magic link token
   */
  async verifyMagicLinkToken(token, email) {
    const tokenData = magicLinkTokens.get(token);

    if (!tokenData) {
      throw new Error('Invalid or expired token');
    }

    if (Date.now() > tokenData.expiresAt) {
      magicLinkTokens.delete(token);
      throw new Error('Token has expired');
    }

    if (tokenData.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error('Email does not match token');
    }

    // Token is valid, remove it (one-time use)
    magicLinkTokens.delete(token);

    return tokenData;
  }

  /**
   * Send magic link email
   */
  async sendMagicLink(email, baseUrl) {
    const token = this.generateMagicLinkToken(email);
    await emailService.sendMagicLink(email, token, baseUrl);
    return { 
      success: true, 
      message: 'Magic link sent to your email',
      token: token // Return token so we can construct the URL
    };
  }

  /**
   * Verify magic link and create/update user session
   */
  async verifyAndCreateSession(token, email) {
    // Verify token
    await this.verifyMagicLinkToken(token, email);

    // Find or create user
    let user = await UserModel.findByEmail(email);
    const isNewUser = !user;
    
    if (!user) {
      user = await UserModel.create({
        email,
        name: email.split('@')[0], // Default name from email
        subscriptionStatus: 'free', // Initialize free tier
      });
    }

    // Trigger n8n workflow for new user onboarding
    if (isNewUser) {
      // Fire and forget - don't wait for n8n response
      n8nService.triggerUserOnboarding(user.toJSON()).catch(err => {
        console.error('[Auth] Failed to trigger user onboarding workflow:', err.message);
      });
    }

    // Generate JWT token
    const jwtToken = this.generateJWT(user);

    return {
      success: true,
      user: user.toJSON(),
      token: jwtToken,
      isNewUser,
    };
  }

  /**
   * Generate JWT token
   */
  generateJWT(user) {
    // Handle both MongoDB documents and plain objects
    const userId = user._id ? user._id.toString() : user.id;
    const email = user.email;
    
    return jwt.sign(
      {
        userId: userId,
        email: email,
      },
      this.JWT_SECRET,
      { expiresIn: '30d' } // Token expires in 30 days
    );
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token) {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of magicLinkTokens.entries()) {
      if (now > data.expiresAt) {
        magicLinkTokens.delete(token);
      }
    }
  }
}

module.exports = new AuthService();

