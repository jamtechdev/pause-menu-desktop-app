# n8n Workflow Setup Guide - Complete Instructions

This guide will help you set up all n8n workflows for LetMeSell/Pause Menu.

---

## Prerequisites

1. **n8n Installed**
   - Option 1: Install via npm: `npm install -g n8n`
   - Option 2: Use Docker: `docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n`
   - Option 3: Use n8n Cloud (https://n8n.io/cloud)

2. **Access n8n UI**
   - Local: http://localhost:5678
   - Cloud: Your n8n cloud URL

3. **SMTP Email Credentials**
   - Gmail, SendGrid, Mailgun, or any SMTP provider
   - You'll need: SMTP host, port, username, password

---

## Step 1: Configure SMTP Email in n8n

1. Open n8n UI
2. Go to **Settings** → **Credentials**
3. Click **Add Credential**
4. Search for **SMTP**
5. Fill in your SMTP details:
   - **Host**: `smtp.gmail.com` (or your SMTP host)
   - **Port**: `587` (or `465` for SSL)
   - **User**: Your email address
   - **Password**: Your email password or app password
   - **Secure**: Enable if using SSL/TLS
6. Click **Save**
7. **Note the credential name** (e.g., "SMTP Account") - you'll need it later

---

## Step 2: Import Workflows

### Method A: Import JSON Files (Recommended)

1. In n8n UI, click **Workflows** → **Import from File**
2. Import each workflow file:
   - `user-onboarding.json`
   - `subscription-lifecycle.json`
   - `app-installed.json`
3. After importing, you'll need to:
   - Update SMTP credentials in each email node
   - Update webhook URLs if needed
   - Activate each workflow

### Method B: Create Manually (Step-by-Step)

Follow the detailed instructions below for each workflow.

---

## Workflow 1: User Onboarding

### Purpose
Sends welcome email when a new user signs up.

### Setup Steps

1. **Create New Workflow**
   - Click **Workflows** → **Add Workflow**
   - Name it: "User Onboarding - LetMeSell"

2. **Add Webhook Node**
   - Drag **Webhook** node onto canvas
   - Configure:
     - **HTTP Method**: POST
     - **Path**: `user-onboarding`
     - **Response Mode**: "When Last Node Finishes"
   - Click **Execute Node** to get the webhook URL
   - **Copy the webhook URL** - you'll need it for backend config

3. **Add Email Node**
   - Drag **Email Send** node onto canvas
   - Connect it to the Webhook node
   - Configure:
     - **From Email**: `noreply@letmesell.com` (or your email)
     - **To Email**: `={{ $json.email }}`
     - **Subject**: `Welcome to Pause Menu! 🎉`
     - **Email Type**: HTML
     - **Message**: Use the HTML template from the JSON file or create your own
   - **Select Credentials**: Choose your SMTP credential

4. **Add Respond to Webhook Node**
   - Drag **Respond to Webhook** node
   - Connect it after the Email node
   - Configure:
     - **Respond With**: JSON
     - **Response Body**: `{ "success": true, "message": "User onboarding workflow triggered" }`

5. **Activate Workflow**
   - Click **Active** toggle in top right
   - Workflow is now live!

### Test the Workflow

```bash
curl -X POST http://localhost:5678/webhook/user-onboarding \
  -H "Content-Type: application/json" \
  -d '{
    "event": "user-onboarding",
    "userId": "test_user_123",
    "email": "test@example.com",
    "name": "Test User",
    "subscriptionStatus": "free",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }'
```

---

## Workflow 2: Subscription Lifecycle

### Purpose
Sends confirmation emails when subscription status changes (created, updated, canceled).

### Setup Steps

1. **Create New Workflow**
   - Name: "Subscription Lifecycle - LetMeSell"

2. **Add Webhook Node**
   - **HTTP Method**: POST
   - **Path**: `subscription-lifecycle`
   - **Response Mode**: "When Last Node Finishes"
   - Copy the webhook URL

3. **Add IF Node** (Conditional Logic)
   - Drag **IF** node
   - Configure to check `eventType`:
     - **Condition 1**: `{{ $json.eventType }}` equals `created`
     - **Condition 2**: `{{ $json.eventType }}` equals `updated`
     - **Condition 3**: `{{ $json.eventType }}` equals `canceled`
   - This will create 3 output branches

4. **Add Email Nodes** (3 total)
   - **Email 1 - Created**: 
     - Connect to IF node output 1 (created)
     - Subject: `🎉 Subscription Activated - Welcome to Pro!`
     - Use HTML template for subscription created
   - **Email 2 - Updated**:
     - Connect to IF node output 2 (updated)
     - Subject: `Subscription Updated`
     - Use HTML template for subscription updated
   - **Email 3 - Canceled**:
     - Connect to IF node output 3 (canceled)
     - Subject: `Subscription Canceled`
     - Use HTML template for subscription canceled
   - Configure all emails with your SMTP credentials

5. **Add Respond to Webhook Node**
   - Connect all email nodes to this node
   - Response: `{ "success": true, "message": "Subscription lifecycle workflow completed" }`

6. **Activate Workflow**

### Test the Workflow

```bash
# Test created event
curl -X POST http://localhost:5678/webhook/subscription-lifecycle \
  -H "Content-Type: application/json" \
  -d '{
    "event": "subscription-lifecycle",
    "eventType": "created",
    "userId": "user_123",
    "plan": "pro",
    "status": "active"
  }'
```

---

## Workflow 3: App Installed

### Purpose
Sends setup guide email and tracks app installation.

### Setup Steps

1. **Create New Workflow**
   - Name: "App Installed - LetMeSell"

2. **Add Webhook Node**
   - **HTTP Method**: POST
   - **Path**: `app-installed`
   - **Response Mode**: "When Last Node Finishes"
   - Copy the webhook URL

3. **Add Email Node**
   - **Subject**: `🚀 Pause Menu Setup Guide`
   - **To Email**: `={{ $json.email }}`
   - Use HTML template for setup guide

4. **Add Google Sheets Node** (Optional - for tracking)
   - Drag **Google Sheets** node
   - Configure:
     - **Operation**: Append
     - **Spreadsheet**: Create or select a spreadsheet
     - **Sheet**: "Installations"
     - **Columns**: Map the data fields
   - **Note**: You'll need Google Sheets OAuth credentials

   **Alternative**: Use **HTTP Request** node to send data to your database API instead

5. **Add Respond to Webhook Node**
   - Response: `{ "success": true, "message": "App installation tracked successfully" }`

6. **Activate Workflow**

### Test the Workflow

```bash
curl -X POST http://localhost:5678/webhook/app-installed \
  -H "Content-Type: application/json" \
  -d '{
    "event": "app-installed",
    "userId": "user_123",
    "deviceId": "device_456",
    "deviceType": "desktop",
    "os": "Windows",
    "appVersion": "1.0.0",
    "installedAt": "2024-01-01T00:00:00.000Z"
  }'
```

---

## Step 3: Configure Backend

1. **Update `.env` file** in your server directory:
   ```env
   N8N_WEBHOOK_URL=http://localhost:5678/webhook
   ```
   
   For production:
   ```env
   N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook
   ```

2. **Restart your server**

3. **Verify n8n is connected**:
   ```bash
   curl http://localhost:3000/api/n8n/status
   ```
   
   Should return:
   ```json
   {
     "success": true,
     "enabled": true,
     "baseUrl": "http://localhost:5678/webhook",
     "message": "n8n workflows are enabled"
   }
   ```

---

## Step 4: Test End-to-End

### Test User Onboarding
1. Create a new user account (sign up with magic link)
2. Check n8n workflow execution logs
3. Verify welcome email is sent

### Test Subscription Lifecycle
1. Complete a Stripe checkout
2. Check n8n workflow execution logs
3. Verify confirmation email is sent

### Test App Installed
1. Launch the desktop app for the first time
2. App should call `/api/n8n/app-installed`
3. Check n8n workflow execution logs
4. Verify setup guide email is sent

---

## Troubleshooting

### Workflows Not Triggering

1. **Check n8n Status**:
   ```bash
   curl http://localhost:3000/api/n8n/status
   ```

2. **Check n8n Logs**:
   - In n8n UI, go to **Executions** tab
   - Check for errors or failed executions

3. **Verify Webhook URLs**:
   - Make sure `N8N_WEBHOOK_URL` in `.env` matches your n8n webhook base URL
   - Webhook paths should be: `/user-onboarding`, `/subscription-lifecycle`, `/app-installed`

4. **Check SMTP Credentials**:
   - Verify SMTP credentials are correct
   - Test email sending manually in n8n

### Email Not Sending

1. **Check SMTP Settings**:
   - Verify host, port, username, password
   - For Gmail, use App Password (not regular password)

2. **Check Email Node Configuration**:
   - Verify `toEmail` field is correctly mapped
   - Check email templates for syntax errors

3. **Test Email Node**:
   - Click "Execute Node" on email node
   - Check for error messages

### Webhook Not Receiving Data

1. **Check Webhook URL**:
   - Copy webhook URL from n8n
   - Verify it matches backend configuration

2. **Check Backend Logs**:
   - Look for n8n trigger logs in server console
   - Check for connection errors

3. **Test Webhook Manually**:
   - Use curl or Postman to test webhook directly
   - Verify data format matches expected schema

---

## Production Deployment

### n8n Cloud Setup

1. Sign up at https://n8n.io/cloud
2. Create workflows in cloud instance
3. Get webhook URLs from cloud instance
4. Update `N8N_WEBHOOK_URL` in production `.env`

### Self-Hosted n8n

1. Deploy n8n on your server (Docker recommended)
2. Set up reverse proxy (nginx) if needed
3. Configure SSL/TLS for HTTPS
4. Update `N8N_WEBHOOK_URL` in production `.env`

### Security Considerations

1. **Webhook Authentication**:
   - Consider adding authentication to webhooks
   - Use webhook secrets or API keys

2. **SMTP Security**:
   - Use secure SMTP connections (TLS/SSL)
   - Store credentials securely

3. **Rate Limiting**:
   - Configure rate limiting in n8n
   - Monitor workflow execution

---

## Additional Resources

- **n8n Documentation**: https://docs.n8n.io/
- **n8n Community**: https://community.n8n.io/
- **Workflow Templates**: https://n8n.io/workflows/

---

## Support

If you encounter issues:
1. Check n8n execution logs
2. Check backend server logs
3. Verify all credentials are correct
4. Test workflows individually
5. Review this guide for missed steps

---

## Status: ✅ Ready to Use

Once all workflows are set up and activated, your n8n automation is complete! The backend will automatically trigger these workflows when:
- New users sign up
- Subscriptions change
- Apps are installed

All workflows are designed to fail gracefully - if n8n is unavailable, the main application flow continues normally.

