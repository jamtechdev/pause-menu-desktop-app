// User routes

const express = require('express');
const router = express.Router();
const { UserModel } = require('../models/user');
const { authenticateToken } = require('../middleware/auth');
const stripeService = require('../services/stripe');

/**
 * GET /api/user/profile
 * Get current user profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Handle both MongoDB documents and plain objects
    const userData = user.toJSON ? user.toJSON() : {
      id: user._id ? user._id.toString() : user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      subscriptionStatus: user.subscriptionStatus,
    };

    res.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error('[User] Profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get user profile',
    });
  }
});

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    const user = await UserModel.update(req.user.userId, { name });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Handle both MongoDB documents and plain objects
    const userData = user.toJSON ? user.toJSON() : {
      id: user._id ? user._id.toString() : user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      subscriptionStatus: user.subscriptionStatus,
    };

    res.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error('[User] Update profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile',
    });
  }
});

/**
 * GET /api/user/subscription-status
 * Get subscription status by email (public endpoint for web app)
 */
router.get('/subscription-status', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
      });
    }

    // Find user by email
    const user = await UserModel.findByEmail(email);

    if (!user) {
      return res.json({
        success: true,
        subscriptionStatus: 'free',
        subscription: {
          plan: 'free',
          active: false,
        },
      });
    }

    // Get subscription status
    const userId = user._id ? user._id.toString() : user.id;
    const subscription = await stripeService.getSubscriptionStatus(userId);

    res.json({
      success: true,
      subscriptionStatus: subscription.plan,
      subscription,
    });
  } catch (error) {
    console.error('[User] Subscription status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get subscription status',
    });
  }
});

module.exports = router;

