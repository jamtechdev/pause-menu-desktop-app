# LetMeSell Web - Payment & Subscription Portal

This is the web application for **Pause Menu** (formerly LetMeSell) that handles payments, subscriptions, and account management.

## Features

- **Home Page**: Landing page with features and call-to-action
- **Pricing Page**: Display pricing plans with Stripe checkout integration
- **Download Page**: Windows app download page
- **Success Page**: Post-checkout success page

## Payment Flow

1. User visits the website
2. Views pricing plans
3. Clicks "Subscribe" on a plan
4. Enters email address
5. Redirected to Stripe Checkout
6. Completes payment
7. Redirected to success page
8. Downloads Windows app
9. Logs in with email
10. App checks subscription status → unlocks Pro features

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables (create `.env` file):
```
REACT_APP_API_URL=http://localhost:3000
```

3. Start development server:
```bash
npm start
```

## Backend Integration

This web app integrates with the backend API at `http://localhost:3000` (or configured via `REACT_APP_API_URL`).

### Required Backend Endpoints

- `POST /api/auth/login` - Request magic link
- `POST /api/subscription/checkout` - Create Stripe checkout session
- `GET /api/subscription/publishable-key` - Get Stripe publishable key

### Note on Checkout Endpoint

The current backend checkout endpoint requires authentication. For the web flow, you may need to:

1. Create a public checkout endpoint that accepts email
2. Or modify the existing endpoint to handle unauthenticated requests
3. Account creation happens during Stripe checkout or after successful payment

## Stripe Integration

The app uses Stripe Checkout for payment processing. Make sure your backend has:
- Stripe secret key configured
- Webhook endpoint set up for subscription events
- Success/cancel URLs configured

## Project Structure

```
src/
  components/     # Reusable components
    PricingCard.tsx
    EmailModal.tsx
  pages/          # Page components
    Home.tsx
    Pricing.tsx
    Download.tsx
    Success.tsx
  services/       # API services
    api.ts
```

## Build for Production

```bash
npm run build
```

The build folder will contain the production-ready files.
