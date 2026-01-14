// User routes

const express = require('express');
const router = express.Router();
const { UserModel } = require('../models/user');
const { authenticateToken } = require('../middleware/auth');

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

module.exports = router;

