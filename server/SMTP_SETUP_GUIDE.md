# SMTP Setup Guide for Clients

## What is SMTP?

SMTP (Simple Mail Transfer Protocol) is used to send emails from your application. We need your email account credentials to send magic link authentication emails to your users.

## What Information Do We Need?

### Minimum Required Information:

1. **SMTP Server Address** (e.g., `smtp.gmail.com`)
2. **SMTP Port** (usually `587` for TLS or `465` for SSL)
3. **Your Email Address** (the one that will send emails)
4. **Email Password** (or App Password for Gmail)

## Step-by-Step Setup by Provider

### Option 1: Gmail (Recommended for Testing)

**Advantages:**
- Free
- Easy to set up
- Reliable delivery

**Steps:**
1. Go to your Google Account: https://myaccount.google.com/
2. Enable **2-Step Verification** (if not already enabled)
3. Go to **App Passwords**: https://myaccount.google.com/apppasswords
4. Select **Mail** and **Other (Custom name)**
5. Enter "LetMeSell" as the name
6. Click **Generate**
7. Copy the 16-character password (you'll see it only once!)

**Information to Provide:**
- SMTP Host: `smtp.gmail.com`
- SMTP Port: `587`
- Encryption: `TLS`
- Email: `your-email@gmail.com`
- Username: `your-email@gmail.com`
- Password: `xxxx xxxx xxxx xxxx` (the 16-character app password)
- From Email: `your-email@gmail.com`

### Option 2: Outlook / Microsoft 365

**Steps:**
1. Use your existing Outlook/Office365 account
2. If you have 2FA enabled, you may need an App Password

**Information to Provide:**
- SMTP Host: `smtp.office365.com`
- SMTP Port: `587`
- Encryption: `TLS`
- Email: `your-email@outlook.com` or `your-email@yourdomain.com`
- Username: `your-email@outlook.com`
- Password: Your account password or App Password
- From Email: `your-email@outlook.com`

### Option 3: Custom Domain Email

If you have a custom domain email (e.g., `support@yourcompany.com`):

**Information to Provide:**
- SMTP Host: Usually `mail.yourdomain.com` or provided by your hosting
- SMTP Port: Usually `587` (TLS) or `465` (SSL)
- Encryption: `TLS` or `SSL`
- Email: `your-email@yourdomain.com`
- Username: Usually the full email address
- Password: Your email account password
- From Email: `your-email@yourdomain.com`

**Where to find this:**
- Check your hosting provider's email settings
- Look in cPanel or your hosting control panel
- Contact your hosting support if unsure

## Security & Privacy

### What We Do With Your Credentials:
- ✅ Store securely in environment variables
- ✅ Use only for sending authentication emails
- ✅ Never share with third parties
- ✅ Encrypt in transit and at rest

### Best Practices:
- Use a dedicated email account for the application (not your personal email)
- For Gmail, always use App Passwords (never your regular password)
- Consider creating a separate email like `noreply@yourdomain.com` or `app@yourdomain.com`
- Regularly rotate passwords

## Troubleshooting

### "Authentication Failed"
- Double-check your password
- For Gmail, make sure you're using an App Password, not your regular password
- Verify 2-Step Verification is enabled (for Gmail)

### "Connection Timeout"
- Check if your firewall is blocking the SMTP port
- Verify the SMTP host and port are correct
- Some networks block SMTP ports - try from a different network

### "Email Not Received"
- Check spam/junk folder
- Verify the recipient email address is correct
- Check if your email provider has sending limits

## Support

If you need help finding your SMTP settings:
- **Gmail**: https://support.google.com/mail/answer/7126229
- **Outlook**: https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353
- **Custom Domain**: Contact your hosting provider

## Quick Reference

| Provider | SMTP Host | Port | Encryption |
|----------|-----------|------|------------|
| Gmail | smtp.gmail.com | 587 | TLS |
| Gmail (SSL) | smtp.gmail.com | 465 | SSL |
| Outlook | smtp.office365.com | 587 | TLS |
| Yahoo | smtp.mail.yahoo.com | 587 | TLS |
| Custom | mail.yourdomain.com | 587 | TLS |


