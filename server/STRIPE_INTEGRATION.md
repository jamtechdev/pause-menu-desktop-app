# Stripe Integration - Complete Implementation

## ✅ Status: Fully Implemented

All Stripe integration features have been implemented and are ready for use.

---

## Configuration

### Environment Variables

Add to `.env` file:

```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here  # Optional for local testing
```

---

## API Endpoints

### 1. Get Subscription Status
**GET** `/api/subscription/status`
- **Auth:** Required (JWT token)
- **Response:**
```json
{
  "success": true,
  "subscription": {
    "status": "active",
    "plan": "pro",
    "active": true,
    "currentPeriodStart": "2024-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "features": {
      "maxDocuments": -1,
      "maxStorageMB": 1000,
      "advancedAnalytics": true,
      "prioritySupport": true,
      "customBranding": true,
      "apiAccess": true,
      "teamCollaboration": false
    }
  }
}
```

### 2. Create Checkout Session
**POST** `/api/subscription/checkout`
- **Auth:** Required (JWT token)
- **Body:**
```json
{
  "plan": "pro"  // or "enterprise"
}
```
- **Response:**
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### 3. Cancel Subscription
**POST** `/api/subscription/cancel`
- **Auth:** Required (JWT token)
- **Response:**
```json
{
  "success": true,
  "message": "Subscription canceled successfully",
  "subscription": {
    "status": "active",
    "plan": "pro",
    "cancelAtPeriodEnd": true,
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z"
  }
}
```

### 4. Get Publishable Key
**GET** `/api/subscription/publishable-key`
- **Auth:** Not required
- **Response:**
```json
{
  "success": true,
  "publishableKey": "pk_test_..."
}
```

### 5. Stripe Webhook
**POST** `/api/subscription/webhook`
- **Auth:** Not required (uses Stripe signature)
- **Headers:** `stripe-signature` (from Stripe)
- **Body:** Raw JSON (Stripe event)

---

## Subscription Tiers

### Free Tier
- Max Documents: 5
- Max Storage: 100 MB
- Advanced Analytics: ❌
- Priority Support: ❌
- Custom Branding: ❌
- API Access: ❌
- Team Collaboration: ❌

### Pro Tier ($9.99/month)
- Max Documents: Unlimited
- Max Storage: 1 GB
- Advanced Analytics: ✅
- Priority Support: ✅
- Custom Branding: ✅
- API Access: ✅
- Team Collaboration: ❌

### Enterprise Tier ($29.99/month)
- Max Documents: Unlimited
- Max Storage: Unlimited
- Advanced Analytics: ✅
- Priority Support: ✅
- Custom Branding: ✅
- API Access: ✅
- Team Collaboration: ✅

---

## Webhook Events Handled

### ✅ checkout.session.completed
Triggered when user completes checkout. Creates/updates subscription record.

### ✅ customer.subscription.updated
Triggered when subscription is updated (plan change, renewal, etc.).

### ✅ customer.subscription.deleted
Triggered when subscription is canceled. Sets user to free tier.

### ✅ invoice.payment_succeeded
Triggered when payment succeeds. Logs the event.

### ✅ invoice.payment_failed
Triggered when payment fails. Sets subscription to `past_due` status.

---

## Feature Access Control

### Using Middleware

Protect routes with feature checks:

```javascript
const { checkFeature, checkPlan } = require('../middleware/features');
const { authenticateToken } = require('../middleware/auth');

// Check specific feature
router.get('/advanced-analytics', 
  authenticateToken, 
  checkFeature('advancedAnalytics'), 
  handler
);

// Check minimum plan
router.get('/pro-only-feature', 
  authenticateToken, 
  checkPlan('pro'), 
  handler
);
```

### Programmatic Check

```javascript
const stripeService = require('../services/stripe');

// Check if user has feature access
const hasAccess = await stripeService.hasFeatureAccess(userId, 'advancedAnalytics');

// Get full subscription status
const status = await stripeService.getSubscriptionStatus(userId);
if (status.features.advancedAnalytics) {
  // User has access
}
```

---

## Testing

### 1. Test Checkout Flow

```bash
# 1. Get JWT token (from magic link)
# 2. Create checkout session
curl -X POST http://localhost:3000/api/subscription/checkout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan":"pro"}'

# 3. Open the returned URL in browser
# 4. Use Stripe test card: 4242 4242 4242 4242
# 5. Any future expiry date, any CVC
# 6. Complete checkout
```

### 2. Test Subscription Status

```bash
curl http://localhost:3000/api/subscription/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Test Cancel Subscription

```bash
curl -X POST http://localhost:3000/api/subscription/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Test Webhook (Local)

Use Stripe CLI:

```bash
stripe listen --forward-to http://localhost:3000/api/subscription/webhook
```

Or use ngrok:

```bash
ngrok http 3000
# Add webhook URL to Stripe dashboard
```

---

## App Startup Check

For desktop app integration:

```javascript
// On app startup
const response = await fetch('http://localhost:3000/api/subscription/status', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});

const { subscription } = await response.json();

// Lock/unlock features based on subscription
if (subscription.active && subscription.plan === 'pro') {
  // Enable Pro features
  enableProFeatures();
} else {
  // Disable Pro features
  disableProFeatures();
  showUpgradePrompt();
}
```

---

## Success/Cancel Pages

- **Success:** `http://localhost:3000/subscription/success`
- **Cancel:** `http://localhost:3000/subscription/cancel`

These pages are automatically shown after Stripe checkout.

---

## Notes

1. **Test Mode:** Current keys are test keys. Replace with live keys for production.
2. **Webhook Secret:** Required for production. Optional for local testing.
3. **Price IDs:** Currently using dynamic pricing. Can be configured with `STRIPE_PRO_PRICE_ID` and `STRIPE_ENTERPRISE_PRICE_ID` for fixed prices.
4. **Subscription Cancellation:** Cancels at period end (doesn't immediately cancel).

---

## Implementation Files

- `server/src/services/stripe.js` - Stripe service
- `server/src/routes/subscription.js` - Subscription routes
- `server/src/middleware/features.js` - Feature access middleware
- `server/src/models/subscription.js` - Subscription model
- `server/src/models/user.js` - User model

---

## Status: ✅ Complete

All features from Phase 4.3 are implemented and ready for use!

