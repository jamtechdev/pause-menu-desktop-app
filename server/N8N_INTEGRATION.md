# n8n Workflow Automation - Complete Implementation

## ✅ Status: Fully Implemented

All n8n workflow automation features have been implemented and are ready for use.

---

## Configuration

### Environment Variables

Add to `.env` file:

```env
N8N_WEBHOOK_URL=http://localhost:5678/webhook
```

**Note:** n8n workflows are optional. If `N8N_WEBHOOK_URL` is not set, workflows will be skipped gracefully without breaking the main application flow.

---

## Implemented Workflows

### 1. ✅ User Onboarding

**Trigger:** Automatically triggered when a new user signs up (verifies magic link for the first time)

**Actions:**
- ✅ Sends welcome email (via n8n)
- ✅ Creates user record (already done in backend)
- ✅ Initializes free tier (already done in backend)

**Data Sent to n8n:**
```json
{
  "event": "user-onboarding",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "userId": "user_id",
  "email": "user@example.com",
  "name": "User Name",
  "subscriptionStatus": "free",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**n8n Webhook URL:** `{N8N_WEBHOOK_URL}/user-onboarding`

---

### 2. ✅ Subscription Lifecycle

**Trigger:** Automatically triggered by Stripe webhook events

**Events Handled:**
- ✅ `checkout.session.completed` → `created` event
- ✅ `customer.subscription.updated` → `updated` or `renewed` event
- ✅ `customer.subscription.deleted` → `canceled` event

**Actions:**
- ✅ Updates user subscription status (already done in backend)
- ✅ Sends confirmation email (via n8n)
- ✅ Unlocks Pro features (already done in backend)

**Data Sent to n8n:**
```json
{
  "event": "subscription-lifecycle",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "eventType": "created|updated|renewed|canceled",
  "userId": "user_id",
  "subscriptionId": "subscription_id",
  "plan": "pro|enterprise",
  "status": "active|canceled|past_due",
  "stripeSubscriptionId": "sub_xxx",
  "stripeCustomerId": "cus_xxx",
  "currentPeriodStart": "2024-01-01T00:00:00.000Z",
  "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
  "cancelAtPeriodEnd": false
}
```

**n8n Webhook URL:** `{N8N_WEBHOOK_URL}/subscription-lifecycle`

---

### 3. ✅ App Installed

**Trigger:** Called by desktop app on first launch

**Actions:**
- ✅ Sends setup guide email (via n8n)
- ✅ Tracks installation (via n8n)

**API Endpoint:** `POST /api/n8n/app-installed`

**Request:**
```json
{
  "deviceId": "device_123",
  "deviceType": "desktop|mobile|web",
  "os": "Windows|macOS|Linux|iOS|Android",
  "appVersion": "1.0.0"
}
```

**Response:**
```json
{
  "success": true,
  "message": "App installation tracked successfully",
  "workflowTriggered": true
}
```

**Data Sent to n8n:**
```json
{
  "event": "app-installed",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "userId": "user_id",
  "deviceId": "device_123",
  "deviceType": "desktop",
  "os": "Windows",
  "appVersion": "1.0.0",
  "installedAt": "2024-01-01T00:00:00.000Z"
}
```

**n8n Webhook URL:** `{N8N_WEBHOOK_URL}/app-installed`

---

## Future Workflows (Ready to Use)

### 4. Upload Notes → LetMeSell Pipeline

**API Endpoint:** `POST /api/n8n/upload-notes`

**Request:**
```json
{
  "fileId": "file_123",
  "fileName": "notes.pdf",
  "fileSize": 1024000
}
```

**n8n Webhook URL:** `{N8N_WEBHOOK_URL}/upload-notes`

---

### 5. Calendar Automation

**API Endpoint:** `POST /api/n8n/calendar-event`

**Request:**
```json
{
  "eventId": "event_123",
  "title": "Meeting with Client",
  "start": "2024-01-01T10:00:00.000Z",
  "end": "2024-01-01T11:00:00.000Z",
  "type": "meeting|reminder|task"
}
```

**n8n Webhook URL:** `{N8N_WEBHOOK_URL}/calendar-automation`

---

### 6. CRM Integration

**API Endpoint:** `POST /api/n8n/crm-sync`

**Request:**
```json
{
  "syncType": "contact|deal|activity",
  "data": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**n8n Webhook URL:** `{N8N_WEBHOOK_URL}/crm-integration`

---

## API Endpoints

### Get n8n Status
**GET** `/api/n8n/status`

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "baseUrl": "http://localhost:5678/webhook",
  "message": "n8n workflows are enabled"
}
```

---

## n8n Workflow Setup

### Step 1: Install n8n

```bash
npm install -g n8n
```

Or use Docker:
```bash
docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
```

### Step 2: Create Workflows

#### User Onboarding Workflow

1. Create new workflow in n8n
2. Add **Webhook** node
   - Method: POST
   - Path: `user-onboarding`
   - Response Mode: "When Last Node Finishes"
3. Add **Send Email** node (Gmail, SMTP, etc.)
   - Use data from webhook: `{{ $json.email }}`
   - Subject: "Welcome to LetMeSell!"
   - Body: Include `{{ $json.name }}` and setup instructions
4. Connect nodes and activate workflow

#### Subscription Lifecycle Workflow

1. Create new workflow in n8n
2. Add **Webhook** node
   - Method: POST
   - Path: `subscription-lifecycle`
3. Add **IF** node to check `eventType`
   - Branch 1: `created` → Send "Subscription Activated" email
   - Branch 2: `updated` → Send "Subscription Updated" email
   - Branch 3: `canceled` → Send "Subscription Canceled" email
4. Add **Send Email** nodes for each branch
5. Connect nodes and activate workflow

#### App Installed Workflow

1. Create new workflow in n8n
2. Add **Webhook** node
   - Method: POST
   - Path: `app-installed`
3. Add **Send Email** node
   - Subject: "LetMeSell Setup Guide"
   - Body: Include setup instructions and links
4. Add **Google Sheets** or **Database** node to track installations
5. Connect nodes and activate workflow

### Step 3: Configure Webhook URL

Update `.env`:
```env
N8N_WEBHOOK_URL=http://localhost:5678/webhook
```

Or for production:
```env
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook
```

---

## Testing

### Test User Onboarding

1. Create a new user (sign up with magic link)
2. Check n8n workflow execution logs
3. Verify welcome email is sent

### Test Subscription Lifecycle

1. Complete a Stripe checkout
2. Check n8n workflow execution logs
3. Verify confirmation email is sent

### Test App Installed

```bash
curl -X POST http://localhost:3000/api/n8n/app-installed \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device_123",
    "deviceType": "desktop",
    "os": "Windows",
    "appVersion": "1.0.0"
  }'
```

### Check n8n Status

```bash
curl http://localhost:3000/api/n8n/status
```

---

## Implementation Details

### Files Created/Modified

- ✅ `server/src/services/n8n.js` - n8n service with all workflow triggers
- ✅ `server/src/routes/n8n.js` - API routes for manual workflow triggers
- ✅ `server/src/services/auth.js` - Integrated user onboarding trigger
- ✅ `server/src/services/stripe.js` - Integrated subscription lifecycle triggers
- ✅ `server/server.js` - Added n8n routes

### Error Handling

- ✅ All n8n triggers are "fire and forget" - failures don't break main flow
- ✅ Errors are logged but don't throw exceptions
- ✅ Works gracefully when n8n is not configured (skips workflows)

### Performance

- ✅ All n8n calls are asynchronous (non-blocking)
- ✅ 5-second timeout on webhook calls
- ✅ Doesn't slow down main application flow

---

## Desktop App Integration

### On App First Launch

```javascript
// Check if this is first launch
const isFirstLaunch = !localStorage.getItem('app_installed');

if (isFirstLaunch) {
  // Track installation
  await fetch('http://localhost:3000/api/n8n/app-installed', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      deviceType: 'desktop',
      os: getOS(),
      appVersion: APP_VERSION,
    }),
  });

  localStorage.setItem('app_installed', 'true');
}
```

---

## Status: ✅ Complete

All n8n workflow automation features from Phase 4.4 are implemented and ready for use!

**Next Steps:**
1. Install and configure n8n
2. Create workflows in n8n UI
3. Set `N8N_WEBHOOK_URL` in `.env`
4. Test workflows

