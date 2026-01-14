// Analytics routes (optional)

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/analytics/event
 * Track analytics events
 */
router.post('/event', authenticateToken, async (req, res) => {
  try {
    const { event, properties } = req.body;

    if (!event) {
      return res.status(400).json({
        success: false,
        message: 'Event name is required',
      });
    }

    // In production, send to analytics service (Mixpanel, Amplitude, etc.)
    console.log(`[Analytics] Event: ${event}`, {
      userId: req.user.userId,
      properties: properties || {},
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Event tracked',
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to track event',
    });
  }
});

module.exports = router;


