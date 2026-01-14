# Testing with Papercut SMTP

Papercut SMTP is a free, local SMTP server perfect for testing emails without needing real email credentials.

## What is Papercut SMTP?

Papercut is a simple SMTP server that runs on your local machine and captures all emails sent to it. It displays them in a web interface, making it perfect for development and testing.

## Setup Instructions

### Step 1: Download Papercut SMTP

1. Download from: https://github.com/ChangemakerStudios/Papercut-SMTP/releases
2. Or use the web version: https://papercut.codeplex.com/
3. Extract and run `Papercut.exe` (Windows) or use the web version

### Step 2: Start Papercut

- **Windows**: Run `Papercut.exe` - it will start automatically
- **Web Version**: Open http://localhost:3744 in your browser
- Default SMTP port: **25** (or configure to use **587**)

### Step 3: Configure Your .env File

Add these settings to your `server/.env` file:

```env
# Papercut SMTP Configuration (for testing)
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=test
SMTP_PASSWORD=test
FROM_EMAIL=test@letmesell.local
SMTP_REJECT_UNAUTHORIZED=false
```

**Note:** Papercut doesn't require authentication, so you can use any username/password.

### Step 4: Alternative Port Configuration

If port 25 is blocked or you want to use a different port:

1. In Papercut, go to **Settings** → **SMTP Port**
2. Change to **587** (or any available port)
3. Update your `.env`:
   ```env
   SMTP_PORT=587
   ```

## Using Papercut

1. Start your Node.js server: `npm start`
2. Send a test email (via your API)
3. Open Papercut - you'll see the email appear instantly!
4. Click on any email to view:
   - Full HTML content
   - Plain text version
   - Headers
   - Attachments (if any)

## Benefits

✅ **No real email credentials needed**
✅ **Instant email viewing**
✅ **No spam or email limits**
✅ **Perfect for development**
✅ **Free and open source**
✅ **Works offline**

## Alternative Testing Tools

### 1. Mailtrap (Cloud-based)
- **URL**: https://mailtrap.io/
- **Free tier**: 500 emails/month
- **Setup**: Get SMTP credentials from dashboard
- **Best for**: Team testing, CI/CD

### 2. MailHog (Local)
- **URL**: https://github.com/mailhog/MailHog
- **Setup**: `docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog`
- **Web UI**: http://localhost:8025
- **SMTP**: localhost:1025

### 3. MailCatcher (Ruby-based)
- **URL**: https://mailcatcher.me/
- **Setup**: `gem install mailcatcher && mailcatcher`
- **Web UI**: http://localhost:1080
- **SMTP**: localhost:1025

## Quick Start with Papercut

1. **Download and start Papercut**
2. **Update `.env`**:
   ```env
   SMTP_HOST=localhost
   SMTP_PORT=25
   SMTP_SECURE=false
   SMTP_USER=test
   SMTP_PASSWORD=test
   FROM_EMAIL=test@letmesell.local
   ```

3. **Start your server**: `npm start`

4. **Test the API**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com"}'
   ```

5. **Check Papercut** - the magic link email will appear!

## Production vs Testing

**For Testing (Papercut):**
```env
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_USER=test
SMTP_PASSWORD=test
```

**For Production:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-real-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Troubleshooting

### "Connection refused"
- Make sure Papercut is running
- Check if the port matches (25 or 587)
- Try `localhost` instead of `127.0.0.1`

### "Port already in use"
- Another application is using port 25
- Change Papercut to use port 587
- Update `.env` to match

### "Authentication failed"
- Papercut doesn't require real authentication
- Use any username/password (e.g., `test`/`test`)
- Set `SMTP_REJECT_UNAUTHORIZED=false`


