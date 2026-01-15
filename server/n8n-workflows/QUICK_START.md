# n8n Quick Start Guide

Get your n8n workflows up and running in 5 minutes!

## Prerequisites

- n8n installed and running (http://localhost:5678)
- SMTP email credentials (Gmail, SendGrid, etc.)

## Step 1: Start n8n

```bash
# Option 1: npm
npx n8n

# Option 2: Docker
docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
```

Open http://localhost:5678 in your browser.

## Step 2: Configure SMTP

1. In n8n UI: **Settings** → **Credentials** → **Add Credential**
2. Search for **SMTP**
3. Enter your SMTP details:
   - **Host**: `smtp.gmail.com` (or your provider)
   - **Port**: `587`
   - **User**: Your email
   - **Password**: Your password/app password
4. Save as "SMTP Account"

## Step 3: Import Workflows

1. In n8n UI: **Workflows** → **Import from File**
2. Import these files (one by one):
   - `user-onboarding.json`
   - `subscription-lifecycle.json`
   - `app-installed.json`

## Step 4: Update Email Credentials

For each imported workflow:
1. Click on the **Email Send** node(s)
2. Under **Credential to connect with**, select "SMTP Account"
3. Update **From Email** to your email address
4. Save

## Step 5: Activate Workflows

1. For each workflow, click the **Active** toggle (top right)
2. Copy the webhook URL from the Webhook node
3. Note the webhook paths:
   - `/user-onboarding`
   - `/subscription-lifecycle`
   - `/app-installed`

## Step 6: Configure Backend

Add to your server `.env` file:

```env
N8N_WEBHOOK_URL=http://localhost:5678/webhook
```

Restart your server.

## Step 7: Test

### Test User Onboarding
```bash
curl -X POST http://localhost:5678/webhook/user-onboarding \
  -H "Content-Type: application/json" \
  -d '{
    "event": "user-onboarding",
    "email": "test@example.com",
    "name": "Test User",
    "userId": "user_123"
  }'
```

Check your email inbox!

### Verify Backend Connection
```bash
curl http://localhost:3000/api/n8n/status
```

Should return:
```json
{
  "success": true,
  "enabled": true,
  "baseUrl": "http://localhost:5678/webhook"
}
```

## Done! ✅

Your workflows are now active. The backend will automatically trigger them when:
- ✅ New users sign up → Welcome email
- ✅ Subscriptions change → Confirmation email
- ✅ App is installed → Setup guide email

## Troubleshooting

**Workflows not triggering?**
- Check `N8N_WEBHOOK_URL` in `.env` matches your n8n URL
- Verify workflows are **Active** in n8n
- Check n8n **Executions** tab for errors

**Emails not sending?**
- Verify SMTP credentials are correct
- Test email node manually (click "Execute Node")
- Check spam folder

**Need more help?**
- See `N8N_SETUP_GUIDE.md` for detailed instructions
- Check n8n execution logs in n8n UI

