// Subscription routes

const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripe');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/subscription/status
 * Get subscription status for current user
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const subscription = await stripeService.getSubscriptionStatus(req.user.userId);

    res.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error('[Subscription] Status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get subscription status',
    });
  }
});

/**
 * POST /api/subscription/checkout
 * Create Stripe checkout session
 */
router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        success: false,
        message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env (optional for testing)',
      });
    }

    const { plan = 'pro' } = req.body;
    const baseUrl = req.protocol + '://' + req.get('host');

    const session = await stripeService.createCheckoutSession(
      req.user.userId,
      plan,
      baseUrl
    );

    res.json({
      success: true,
      sessionId: session.sessionId,
      url: session.url,
    });
  } catch (error) {
    console.error('[Subscription] Checkout error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create checkout session',
    });
  }
});

/**
 * POST /api/subscription/webhook
 * Stripe webhook endpoint
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('[Subscription] STRIPE_SECRET_KEY not set, Stripe webhook disabled');
      return res.status(503).json({
        success: false,
        message: 'Stripe is not configured',
      });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.warn('[Subscription] STRIPE_WEBHOOK_SECRET not set, skipping signature verification');
      event = JSON.parse(req.body);
    } else {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }

    await stripeService.handleWebhook(event);

    res.json({ received: true });
  } catch (error) {
    console.error('[Subscription] Webhook error:', error);
    res.status(400).json({
      success: false,
      message: `Webhook Error: ${error.message}`,
    });
  }
});

module.exports = router;

