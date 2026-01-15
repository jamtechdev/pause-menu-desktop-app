# n8n Workflow Files

This directory contains n8n workflow JSON files that can be imported directly into n8n.

## Workflows Included

1. **user-onboarding.json** - Sends welcome email when new users sign up
2. **subscription-lifecycle.json** - Handles subscription events (created, updated, canceled)
3. **app-installed.json** - Sends setup guide email and tracks app installations

## Quick Start

1. **Import Workflows**:
   - Open n8n UI (http://localhost:5678)
   - Go to **Workflows** → **Import from File**
   - Select each JSON file and import

2. **Configure Credentials**:
   - Set up SMTP credentials in n8n Settings
   - Update email nodes to use your SMTP credentials
   - For Google Sheets tracking (app-installed), set up Google Sheets OAuth

3. **Activate Workflows**:
   - Click the **Active** toggle on each workflow
   - Copy webhook URLs from each workflow

4. **Update Backend**:
   - Add `N8N_WEBHOOK_URL=http://localhost:5678/webhook` to `.env`
   - Restart server

## Detailed Setup

See **N8N_SETUP_GUIDE.md** for complete step-by-step instructions.

## Workflow Details

### User Onboarding
- **Webhook Path**: `/user-onboarding`
- **Trigger**: Automatically when new user signs up
- **Actions**: Sends welcome email

### Subscription Lifecycle
- **Webhook Path**: `/subscription-lifecycle`
- **Trigger**: Automatically on Stripe webhook events
- **Actions**: Sends appropriate email based on event type (created/updated/canceled)

### App Installed
- **Webhook Path**: `/app-installed`
- **Trigger**: Called by desktop app on first launch
- **Actions**: Sends setup guide email and tracks installation

## Notes

- All workflows include HTML email templates
- Workflows are designed to fail gracefully if n8n is unavailable
- Email templates can be customized in n8n UI
- Google Sheets tracking in app-installed workflow is optional

### Email Addresses

✅ **Updated**: The backend now automatically includes `email` addresses in all workflow data, so you can use `={{ $json.email }}` directly in email nodes without needing to fetch it separately.

## Testing

After importing, test each workflow using the curl commands in N8N_SETUP_GUIDE.md.

