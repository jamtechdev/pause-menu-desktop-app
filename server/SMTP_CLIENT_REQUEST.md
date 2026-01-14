# SMTP Configuration - Information Request

To set up email sending for LetMeSell, please provide the following SMTP information:

## Required Information

### 1. SMTP Server Details
- **SMTP Host/Server**: (e.g., `smtp.gmail.com`, `smtp.office365.com`, `mail.yourdomain.com`)
- **SMTP Port**: (Common ports: `587` for TLS, `465` for SSL, `25` for unencrypted)
- **Encryption Type**: 
  - TLS (recommended, usually port 587)
  - SSL (usually port 465)
  - None (not recommended)

### 2. Authentication Credentials
- **Email Address**: The email address that will send the magic link emails
- **Username**: (Usually the same as email address, but some servers use different format)
- **Password**: 
  - For Gmail: App Password (not regular password)
  - For Outlook/Office365: Regular password or App Password
  - For custom SMTP: Password provided by email provider

### 3. Sender Information
- **From Email Address**: The email address that will appear as the sender
- **From Name** (optional): Display name (e.g., "LetMeSell Team")

## Common Email Providers

### Gmail
- **SMTP Host**: `smtp.gmail.com`
- **SMTP Port**: `587` (TLS) or `465` (SSL)
- **Username**: Your Gmail address
- **Password**: App Password (not regular password)
- **How to get App Password**: 
  1. Enable 2-Step Verification
  2. Go to https://myaccount.google.com/apppasswords
  3. Generate a new app password for "Mail"
  4. Use the 16-character password

### Outlook / Office 365
- **SMTP Host**: `smtp.office365.com`
- **SMTP Port**: `587` (TLS)
- **Username**: Your Outlook/Office365 email address
- **Password**: Your account password or App Password

### Custom Domain Email (cPanel, etc.)
- **SMTP Host**: Usually `mail.yourdomain.com` or provided by hosting
- **SMTP Port**: Usually `587` (TLS) or `465` (SSL)
- **Username**: Full email address
- **Password**: Email account password

## Security Notes

⚠️ **Important Security Information:**
- Never share passwords via email or insecure channels
- Use secure methods (encrypted file, password manager, secure portal) to share credentials
- For Gmail, always use App Passwords, never regular passwords
- Consider using environment variables or secure vaults for storing credentials

## Information Collection Template

You can copy and send this to your client:

```
Hi [Client Name],

To set up email functionality for LetMeSell, I need the following SMTP 
configuration details:

1. SMTP Server:
   - Host/Server: _______________
   - Port: _______________
   - Encryption (TLS/SSL): _______________

2. Email Account:
   - Email Address: _______________
   - Username: _______________
   - Password: _______________
   (For Gmail, please provide an App Password, not your regular password)

3. Sender Information:
   - From Email: _______________
   - From Name (optional): _______________

Please provide this information through a secure channel.

Thank you!
```

## Quick Checklist

- [ ] SMTP Host/Server address
- [ ] SMTP Port number
- [ ] Encryption type (TLS/SSL)
- [ ] Email address for sending
- [ ] Username (if different from email)
- [ ] Password or App Password
- [ ] From email address
- [ ] From name (optional)


