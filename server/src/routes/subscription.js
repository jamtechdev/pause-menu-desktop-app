// Subscription routes

const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripe');
const { authenticateToken } = require('../middleware/auth');
const { UserModel } = require('../models/user');

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
 * Create Stripe checkout session (authenticated)
 */
router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        success: false,
        message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env (optional for testing)',
      });
    }

    const { plan = 'pro', billingPeriod = 'monthly' } = req.body;
    // Use web app URL for success/cancel redirects
    const webAppUrl = process.env.WEB_APP_URL || process.env.REACT_APP_URL || 'http://localhost:3001';

    const session = await stripeService.createCheckoutSession(
      req.user.userId,
      plan,
      webAppUrl,
      billingPeriod
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
 * POST /api/subscription/checkout-public
 * Create Stripe checkout session (public - for web flow)
 * Accepts email and creates/finds user, then creates checkout
 */
router.post('/checkout-public', async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        success: false,
        message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env',
      });
    }

    const { plan = 'pro', email, billingPeriod = 'monthly' } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
      });
    }

    // Use web app URL for success/cancel redirects
    // Default to localhost:3001 for React dev server, or use environment variable
    const webAppUrl = process.env.WEB_APP_URL || process.env.REACT_APP_URL || 'http://localhost:3001';

    // Verify UserModel is properly imported
    if (!UserModel || typeof UserModel.findByEmail !== 'function') {
      console.error('[Subscription] UserModel import error:', typeof UserModel, UserModel);
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: UserModel not properly loaded',
      });
    }

    // Find or create user by email
    let user = await UserModel.findByEmail(email);
    if (!user) {
      // Create user account
      user = await UserModel.create({
        email,
        name: email.split('@')[0],
        subscriptionStatus: 'free',
      });
    }

    // Handle both MongoDB documents and plain objects
    const userId = user._id ? user._id.toString() : user.id;

    const session = await stripeService.createCheckoutSession(
      userId,
      plan,
      webAppUrl,
      billingPeriod
    );

    res.json({
      success: true,
      sessionId: session.sessionId,
      url: session.url,
    });
  } catch (error) {
    console.error('[Subscription] Public checkout error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create checkout session',
    });
  }
});

/**
 * POST /api/subscription/cancel
 * Cancel subscription
 */
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        success: false,
        message: 'Stripe is not configured',
      });
    }

    const result = await stripeService.cancelSubscription(req.user.userId);

    res.json({
      success: true,
      message: 'Subscription canceled successfully',
      subscription: result,
    });
  } catch (error) {
    console.error('[Subscription] Cancel error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel subscription',
    });
  }
});

/**
 * GET /api/subscription/publishable-key
 * Get Stripe publishable key (for frontend)
 */
router.get('/publishable-key', (req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
  res.json({
    success: true,
    publishableKey,
  });
});

/**
 * GET /api/subscription/history
 * Get subscription history (invoices and payments)
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        success: false,
        message: 'Stripe is not configured',
      });
    }

    const history = await stripeService.getSubscriptionHistory(req.user.userId);

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('[Subscription] History error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get subscription history',
    });
  }
});

/**
 * POST /api/subscription/sync
 * Manually sync subscription status from Stripe
 */
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        success: false,
        message: 'Stripe is not configured',
      });
    }

    const user = await UserModel.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // If user has subscriptionStatus set but no stripeCustomerId, 
    // the webhook might not have fired yet - return current status
    if (!user.stripeCustomerId) {
      const subscription = await stripeService.getSubscriptionStatus(req.user.userId);
      return res.json({
        success: true,
        message: 'Subscription sync pending - webhook not received yet',
        subscription,
      });
    }

    // Fetch latest subscription from Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const stripeSubscription = subscriptions.data[0];
      const plan = stripeSubscription.metadata?.plan || 'pro';
      const status = stripeSubscription.status;

      // Update user subscription status
      await UserModel.update(req.user.userId, {
        subscriptionStatus: status === 'active' ? plan : 'free',
        stripeCustomerId: user.stripeCustomerId,
      });

      // Update or create subscription record
      const { SubscriptionModel } = require('../models/subscription');
      const existingSubscription = await SubscriptionModel.findByUserId(req.user.userId);
      
      if (existingSubscription) {
        await SubscriptionModel.update(existingSubscription.id, {
          status: status,
          plan: plan,
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId: user.stripeCustomerId,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
        });
      } else {
        await SubscriptionModel.create({
          userId: req.user.userId,
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId: user.stripeCustomerId,
          status: status,
          plan: plan,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
        });
      }

      // Get updated subscription status
      const subscription = await stripeService.getSubscriptionStatus(req.user.userId);

      res.json({
        success: true,
        message: 'Subscription synced successfully',
        subscription,
      });
    } else {
      // No active subscription found
      await UserModel.update(req.user.userId, {
        subscriptionStatus: 'free',
      });

      const subscription = await stripeService.getSubscriptionStatus(req.user.userId);
      res.json({
        success: true,
        message: 'No active subscription found',
        subscription,
      });
    }
  } catch (error) {
    console.error('[Subscription] Sync error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync subscription',
    });
  }
});

/**
 * GET /api/subscription/invoice/:invoiceId
 * Proxy invoice PDF (to avoid CORS issues)
 */
router.get('/invoice/:invoiceId', authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        success: false,
        message: 'Stripe is not configured',
      });
    }

    const { invoiceId } = req.params;
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Retrieve the invoice
    const invoice = await stripe.invoices.retrieve(invoiceId);
    
    if (!invoice.invoice_pdf) {
      return res.status(404).json({
        success: false,
        message: 'Invoice PDF not available',
      });
    }

    // Use axios to fetch the PDF (already in dependencies)
    const axios = require('axios');
    
    try {
      const pdfResponse = await axios.get(invoice.invoice_pdf, {
        responseType: 'arraybuffer',
      });

      // Set headers for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="invoice-${invoiceId}.pdf"`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Send the PDF buffer
      res.send(Buffer.from(pdfResponse.data));
    } catch (fetchError) {
      console.error('[Subscription] Error fetching invoice PDF:', fetchError);
      throw new Error('Failed to fetch invoice PDF from Stripe');
    }
  } catch (error) {
    console.error('[Subscription] Invoice proxy error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch invoice',
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

