// Stripe integration service

const { SubscriptionModel } = require('../models/subscription');
const { UserModel } = require('../models/user');
const n8nService = require('./n8n');

class StripeService {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('[Stripe] STRIPE_SECRET_KEY not set, Stripe features will be disabled');
      this.enabled = false;
      this.stripe = null;
    } else {
      this.enabled = true;
      this.stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
  }

  /**
   * Create a Stripe Checkout session
   * @param {string} userId - User ID
   * @param {string} plan - Plan name ('pro' or 'enterprise')
   * @param {string} webAppUrl - Web app URL for success/cancel redirects (default: http://localhost:3001)
   * @param {string} billingPeriod - Billing period ('monthly' or 'yearly')
   */
  async createCheckoutSession(userId, plan = 'pro', webAppUrl = 'http://localhost:3001', billingPeriod = 'monthly') {
    if (!this.enabled || !this.stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in .env');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Handle both MongoDB documents and plain objects
    const stripeCustomerId = user.stripeCustomerId || (user.toObject ? user.toObject().stripeCustomerId : null);
    
    // Get or create Stripe customer
    let customerId = stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;
      await UserModel.update(userId, { stripeCustomerId: customerId });
    }

    // Define pricing plans with actual Stripe price IDs
    const priceIds = {
      pro: {
        monthly: 'price_1Spnpa01z1hHjDb17kZwZtMs', // Monthly Pro
        yearly: 'price_1Spnq101z1hHjDb1wcmLCdad',  // Yearly Pro
      },
      enterprise: {
        monthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || 'price_enterprise_monthly',
        yearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || 'price_enterprise_yearly',
      },
    };

    // Get the correct price ID based on plan and billing period
    const priceId = priceIds[plan]?.[billingPeriod] || priceIds.pro[billingPeriod] || priceIds.pro.monthly;

    // Create checkout session using the price ID directly
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${webAppUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${webAppUrl}/pricing`,
      allow_promotion_codes: true,
      metadata: {
        userId: userId,
        plan: plan,
        billingPeriod: billingPeriod,
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event) {
    if (!this.enabled || !this.stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in .env');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }
  }

  async handleCheckoutCompleted(session) {
    const userId = session.metadata.userId;
    const plan = session.metadata.plan || 'pro';

    // Fetch full subscription details from Stripe
    let subscriptionDetails = null;
    if (session.subscription) {
      subscriptionDetails = await this.stripe.subscriptions.retrieve(session.subscription);
    }

    // Update user subscription status and customer ID
    await UserModel.update(userId, {
      subscriptionStatus: plan,
      stripeCustomerId: session.customer,
    });

    // Create or update subscription record
    const existingSubscription = await SubscriptionModel.findByUserId(userId);
    if (existingSubscription) {
      await SubscriptionModel.update(existingSubscription.id, {
        status: subscriptionDetails ? subscriptionDetails.status : 'active',
        plan: plan,
        stripeSubscriptionId: session.subscription,
        stripeCustomerId: session.customer,
        currentPeriodStart: subscriptionDetails ? new Date(subscriptionDetails.current_period_start * 1000).toISOString() : new Date(),
        currentPeriodEnd: subscriptionDetails ? new Date(subscriptionDetails.current_period_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: subscriptionDetails ? subscriptionDetails.cancel_at_period_end : false,
      });
    } else {
      await SubscriptionModel.create({
        userId,
        stripeSubscriptionId: session.subscription,
        stripeCustomerId: session.customer,
        status: subscriptionDetails ? subscriptionDetails.status : 'active',
        plan: plan,
        currentPeriodStart: subscriptionDetails ? new Date(subscriptionDetails.current_period_start * 1000).toISOString() : new Date(),
        currentPeriodEnd: subscriptionDetails ? new Date(subscriptionDetails.current_period_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: subscriptionDetails ? subscriptionDetails.cancel_at_period_end : false,
      });
    }

    console.log(`[Stripe] Checkout completed for user ${userId}, plan: ${plan}, subscription: ${session.subscription}`);

    // Trigger n8n subscription lifecycle workflow
    const subscriptionRecord = await SubscriptionModel.findByUserId(userId);
    if (subscriptionRecord) {
      n8nService.triggerSubscriptionLifecycle('created', subscriptionRecord.toObject ? subscriptionRecord.toObject() : subscriptionRecord).catch(err => {
        console.error('[Stripe] Failed to trigger subscription lifecycle workflow:', err.message);
      });
    }
  }

  async handleSubscriptionUpdated(stripeSubscription) {
    const subscription = await SubscriptionModel.findByStripeSubscriptionId(stripeSubscription.id);
    if (!subscription) {
      console.warn(`[Stripe] Subscription not found: ${stripeSubscription.id}`);
      return;
    }

    await SubscriptionModel.update(subscription.id, {
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    });

    // Update user subscription status
    await UserModel.update(subscription.userId, {
      subscriptionStatus: stripeSubscription.status === 'active' ? subscription.plan : 'free',
    });

    console.log(`[Stripe] Subscription updated: ${stripeSubscription.id}, status: ${stripeSubscription.status}`);

    // Trigger n8n subscription lifecycle workflow
    const updatedSubscription = await SubscriptionModel.findByStripeSubscriptionId(stripeSubscription.id);
    if (updatedSubscription) {
      const eventType = stripeSubscription.status === 'active' ? 'updated' : 'renewed';
      const subData = updatedSubscription.toObject ? updatedSubscription.toObject() : updatedSubscription;
      n8nService.triggerSubscriptionLifecycle(eventType, subData).catch(err => {
        console.error('[Stripe] Failed to trigger subscription lifecycle workflow:', err.message);
      });
    }
  }

  async handleSubscriptionDeleted(stripeSubscription) {
    const subscription = await SubscriptionModel.findByStripeSubscriptionId(stripeSubscription.id);
    if (!subscription) {
      return;
    }

    await SubscriptionModel.update(subscription.id, {
      status: 'canceled',
    });

    await UserModel.update(subscription.userId, {
      subscriptionStatus: 'free',
    });

    console.log(`[Stripe] Subscription canceled: ${stripeSubscription.id}`);

    // Trigger n8n subscription lifecycle workflow
    if (subscription) {
      const subData = subscription.toObject ? subscription.toObject() : subscription;
      n8nService.triggerSubscriptionLifecycle('canceled', subData).catch(err => {
        console.error('[Stripe] Failed to trigger subscription lifecycle workflow:', err.message);
      });
    }
  }

  async handlePaymentSucceeded(invoice) {
    console.log(`[Stripe] Payment succeeded: ${invoice.id}`);
    // Handle successful payment
  }

  async handlePaymentFailed(invoice) {
    const subscription = await SubscriptionModel.findByStripeSubscriptionId(invoice.subscription);
    if (subscription) {
      await SubscriptionModel.update(subscription.id, {
        status: 'past_due',
      });
    }
    console.log(`[Stripe] Payment failed: ${invoice.id}`);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId) {
    if (!this.enabled || !this.stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in .env');
    }

    const subscription = await SubscriptionModel.findByUserId(userId);
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Cancel the subscription at period end
    const stripeSubscription = await this.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Update local subscription record
    await SubscriptionModel.update(subscription.id, {
      cancelAtPeriodEnd: true,
    });

    console.log(`[Stripe] Subscription scheduled for cancellation: ${subscription.stripeSubscriptionId}`);

    return {
      status: subscription.status,
      plan: subscription.plan,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  /**
   * Get subscription status for a user with feature access
   */
  async getSubscriptionStatus(userId) {
    const subscription = await SubscriptionModel.findByUserId(userId);
    const user = await UserModel.findById(userId);

    // If no subscription record exists, check user's subscriptionStatus field
    // This handles cases where webhook hasn't fired yet but user has upgraded
    if (!subscription) {
      const userPlan = user?.subscriptionStatus || (user?.toObject ? user.toObject().subscriptionStatus : null);
      if (userPlan && userPlan !== 'free') {
        // User has subscription status but no subscription record yet
        // Return the plan from user model
        return {
          status: userPlan,
          plan: userPlan,
          active: true, // Assume active if set in user model
          features: this.getFeatureAccess(userPlan),
        };
      }
      
      return {
        status: 'free',
        plan: 'free',
        active: false,
        features: this.getFeatureAccess('free'),
      };
    }

    const isActive = subscription.status === 'active' && !subscription.cancelAtPeriodEnd;
    const plan = isActive ? subscription.plan : 'free';

    return {
      status: subscription.status,
      plan: plan,
      active: isActive,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      features: this.getFeatureAccess(plan),
    };
  }

  /**
   * Get feature access based on plan
   */
  getFeatureAccess(plan) {
    const features = {
      free: {
        maxDocuments: 5,
        maxStorageMB: 100,
        advancedAnalytics: false,
        prioritySupport: false,
        customBranding: false,
        apiAccess: false,
        teamCollaboration: false,
      },
      pro: {
        maxDocuments: -1, // Unlimited
        maxStorageMB: 1000,
        advancedAnalytics: true,
        prioritySupport: true,
        customBranding: true,
        apiAccess: true,
        teamCollaboration: false,
      },
      enterprise: {
        maxDocuments: -1, // Unlimited
        maxStorageMB: -1, // Unlimited
        advancedAnalytics: true,
        prioritySupport: true,
        customBranding: true,
        apiAccess: true,
        teamCollaboration: true,
      },
    };

    return features[plan] || features.free;
  }

  /**
   * Check if user has access to a specific feature
   */
  async hasFeatureAccess(userId, featureName) {
    const status = await this.getSubscriptionStatus(userId);
    return status.features[featureName] === true || status.features[featureName] === -1;
  }

  /**
   * Get subscription history (invoices and payments)
   */
  async getSubscriptionHistory(userId) {
    if (!this.enabled || !this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const stripeCustomerId = user.stripeCustomerId || (user.toObject ? user.toObject().stripeCustomerId : null);
    if (!stripeCustomerId) {
      return [];
    }

    try {
      // Get invoices from Stripe
      const invoices = await this.stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 50,
        expand: ['data.subscription'],
      });

      // Format history items
      const history = invoices.data.map((invoice) => {
        const subscriptionData = invoice.subscription;
        const isSubscription = subscriptionData && subscriptionData.object === 'subscription';
        
        return {
          id: invoice.id,
          type: isSubscription ? 'subscription' : 'one-time',
          status: invoice.status,
          amount: invoice.amount_paid / 100, // Convert from cents
          currency: invoice.currency.toUpperCase(),
          date: new Date(invoice.created * 1000).toISOString(),
          periodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
          plan: subscriptionData && subscriptionData.items?.data[0]?.price?.nickname || 
                (invoice.lines.data[0]?.price?.nickname) || 
                'Unknown',
          description: invoice.description || invoice.lines.data[0]?.description || 'Subscription payment',
          invoiceUrl: invoice.hosted_invoice_url,
          invoicePdf: invoice.invoice_pdf,
          billingReason: invoice.billing_reason,
        };
      });

      // Sort by date (newest first)
      history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return history;
    } catch (error) {
      console.error('[Stripe] Get subscription history error:', error);
      throw error;
    }
  }
}

module.exports = new StripeService();

