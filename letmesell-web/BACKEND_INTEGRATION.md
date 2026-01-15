# Backend Integration Notes

## Required Backend Modifications

The current backend checkout endpoint (`POST /api/subscription/checkout`) requires authentication. For the web payment flow, you have two options:

### Option 1: Create Public Checkout Endpoint (Recommended)

Create a new endpoint that accepts email and creates a checkout session without requiring authentication:

```javascript
// In server/src/routes/subscription.js

/**
 * POST /api/subscription/checkout-public
 * Create Stripe checkout session for web flow (no auth required)
 */
router.post('/checkout-public', async (req, res) => {
  try {
    const { plan = 'pro', email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
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

    const baseUrl = req.protocol + '://' + req.get('host');
    const session = await stripeService.createCheckoutSession(
      user._id.toString(),
      plan,
      baseUrl
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
```

### Option 2: Modify Existing Endpoint

Modify the existing checkout endpoint to accept email parameter and handle unauthenticated requests:

```javascript
router.post('/checkout', async (req, res) => {
  try {
    const { plan = 'pro', email } = req.body;
    
    let userId;
    
    // If authenticated, use authenticated user
    if (req.user && req.user.userId) {
      userId = req.user.userId;
    } else if (email) {
      // If not authenticated but email provided, find or create user
      let user = await UserModel.findByEmail(email);
      if (!user) {
        user = await UserModel.create({
          email,
          name: email.split('@')[0],
          subscriptionStatus: 'free',
        });
      }
      userId = user._id.toString();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Email is required for unauthenticated checkout',
      });
    }

    const baseUrl = req.protocol + '://' + req.get('host');
    const session = await stripeService.createCheckoutSession(
      userId,
      plan,
      baseUrl
    );

    res.json({
      success: true,
      sessionId: session.sessionId,
      url: session.url,
    });
  } catch (error) {
    // ... error handling
  }
});
```

## Stripe Checkout Configuration

Make sure your Stripe checkout session includes:

1. **Success URL**: `https://yourdomain.com/success?session_id={CHECKOUT_SESSION_ID}`
2. **Cancel URL**: `https://yourdomain.com/pricing`
3. **Customer Email**: Pre-fill with the email provided
4. **Metadata**: Include user ID and plan for webhook processing

## Webhook Events

Ensure your webhook handler processes:
- `checkout.session.completed` - Activate subscription
- `customer.subscription.updated` - Update subscription status
- `customer.subscription.deleted` - Cancel subscription

## Testing

1. Use Stripe test mode keys
2. Test with test card: `4242 4242 4242 4242`
3. Verify webhook events are received
4. Test account creation flow

