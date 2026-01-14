# LetMeSell Backend API Server

Backend API server for LetMeSell desktop application.

## Features

- ✅ Magic link authentication
- ✅ User management
- ✅ Stripe subscription integration
- ✅ File upload handling
- ✅ Analytics tracking

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
   - `MONGODB_URI`: MongoDB connection string (default provided)
   - `JWT_SECRET`: Secret key for JWT tokens
   - `SMTP_HOST`: SMTP server host (e.g., smtp.gmail.com)
   - `SMTP_PORT`: SMTP server port (587 for TLS, 465 for SSL)
   - `SMTP_USER`: SMTP username (your email)
   - `SMTP_PASSWORD`: SMTP password (use app password for Gmail)
   - `FROM_EMAIL`: Email address to send from
   - `STRIPE_SECRET_KEY`: Stripe secret key (optional)
   - `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret (optional)

4. Start the server:
```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Request magic link
  ```json
  {
    "email": "user@example.com"
  }
  ```

- `POST /api/auth/verify` - Verify magic link (JSON)
  ```json
  {
    "token": "magic-link-token",
    "email": "user@example.com"
  }
  ```

- `GET /api/auth/verify?token=xxx&email=xxx` - Verify magic link (Browser redirect)

### User

- `GET /api/user/profile` - Get user profile (requires auth)
- `PUT /api/user/profile` - Update user profile (requires auth)

### Subscription

- `GET /api/subscription/status` - Get subscription status (requires auth)
- `POST /api/subscription/checkout` - Create Stripe checkout session (requires auth)
- `POST /api/subscription/webhook` - Stripe webhook endpoint

### Analytics

- `POST /api/analytics/event` - Track analytics event (requires auth)

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

## Email Configuration

### Gmail Setup
1. Enable 2-Step Verification on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password in `SMTP_PASSWORD`

Example `.env` for Gmail:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
FROM_EMAIL=your-email@gmail.com
```

### Outlook Setup
Example `.env` for Outlook:
```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
FROM_EMAIL=your-email@outlook.com
```

### Testing with Papercut SMTP (Recommended)
For local testing, use Papercut SMTP - a free local SMTP server:

1. **Download Papercut**: https://github.com/ChangemakerStudios/Papercut-SMTP/releases
2. **Start Papercut** (it runs on port 25 by default)
3. **Configure `.env`**:
   ```env
   SMTP_HOST=localhost
   SMTP_PORT=25
   SMTP_SECURE=false
   SMTP_USER=test
   SMTP_PASSWORD=test
   FROM_EMAIL=test@letmesell.local
   ```
4. **View emails** in Papercut's interface - all emails will appear there!

See `TESTING_WITH_PAPERCUT.md` for detailed instructions.

### Development Mode
If SMTP is not configured, the email service will log magic links to the console for development purposes.

## Production

For production:
1. Use a proper database (MongoDB, PostgreSQL, etc.) instead of in-memory storage
2. Set up Redis for token storage
3. Configure SendGrid for email delivery
4. Set up Stripe webhooks
5. Use environment-specific configuration

