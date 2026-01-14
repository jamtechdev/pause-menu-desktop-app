// Stripe integration service

const { SubscriptionModel } = require('../models/subscription');
const { UserModel } = require('../models/user');

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
   */
  async createCheckoutSession(userId, plan = 'pro', baseUrl = 'http://localhost:3000') {
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

    // Define pricing plans
    const plans = {
      pro: {
        priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
        amount: 999, // $9.99 in cents
      },
      enterprise: {
        priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_monthly',
        amount: 2999, // $29.99 in cents
      },
    };

    const selectedPlan = plans[plan] || plans.pro;

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `LetMeSell ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
              description: `Monthly subscription for LetMeSell ${plan} plan`,
            },
            unit_amount: selectedPlan.amount,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/subscription/cancel`,
      metadata: {
        userId: userId,
        plan: plan,
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

    // Update user subscription status
    await UserModel.update(userId, {
      subscriptionStatus: plan,
    });

    // Create or update subscription record
    const subscription = await SubscriptionModel.findByUserId(userId);
    if (subscription) {
      await SubscriptionModel.update(subscription.id, {
        status: 'active',
        plan: plan,
        stripeSubscriptionId: session.subscription,
        stripeCustomerId: session.customer,
      });
    } else {
      await SubscriptionModel.create({
        userId,
        stripeSubscriptionId: session.subscription,
        stripeCustomerId: session.customer,
        status: 'active',
        plan: plan,
      });
    }

    console.log(`[Stripe] Checkout completed for user ${userId}, plan: ${plan}`);
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
   * Get subscription status for a user
   */
  async getSubscriptionStatus(userId) {
    const subscription = await SubscriptionModel.findByUserId(userId);
    const user = await UserModel.findById(userId);

    if (!subscription) {
      return {
        status: 'free',
        plan: 'free',
        active: false,
      };
    }

    return {
      status: subscription.status,
      plan: subscription.plan,
      active: subscription.status === 'active',
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }
}

module.exports = new StripeService();

