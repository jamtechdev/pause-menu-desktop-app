// Email service - Using SMTP (nodemailer)
// Supports Gmail, Outlook, custom SMTP servers, etc.

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.init();
  }

  async init() {
    // Check if SMTP is configured
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
      try {
        // Create SMTP transporter
        const smtpConfig = {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465', // true for 465, false for other ports
          auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          } : false, // Allow no auth for testing tools like Papercut
          // For Gmail, Outlook, etc.
          tls: {
            rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
          },
        };

        // Special handling for Gmail
        if (process.env.SMTP_HOST.includes('gmail.com')) {
          smtpConfig.service = 'gmail';
        }

        // Special handling for localhost/testing (Papercut, MailHog, etc.)
        if (process.env.SMTP_HOST === 'localhost' || process.env.SMTP_HOST === '127.0.0.1') {
          console.log('[Email] Using local SMTP server (Papercut/MailHog) for testing');
          smtpConfig.ignoreTLS = true; // Don't verify TLS for local testing
          smtpConfig.tls = { rejectUnauthorized: false };
        }

        this.transporter = nodemailer.createTransport(smtpConfig);

        // Verify connection
        await this.transporter.verify();
        this.initialized = true;
        console.log('[Email] ✓ SMTP connection verified');
        if (process.env.SMTP_HOST === 'localhost' || process.env.SMTP_HOST === '127.0.0.1') {
          console.log('[Email] 📧 Testing mode: Emails will be captured by local SMTP server');
        }
      } catch (error) {
        console.error('[Email] ✗ SMTP configuration error:', error.message);
        console.warn('[Email] Falling back to console logging for development');
        this.initialized = false;
      }
    } else {
      console.warn('[Email] SMTP not configured, using console logging for development');
      console.warn('[Email] Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in .env');
      console.warn('[Email] For testing, use Papercut: SMTP_HOST=localhost SMTP_PORT=25');
      this.initialized = false;
    }
  }

  async sendMagicLink(email, token, baseUrl = 'http://localhost:3000') {
    const magicLink = `${baseUrl}/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;
    
    const emailContent = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@letmesell.com',
      to: email,
      subject: 'Sign in to LetMeSell',
      html: this.getMagicLinkTemplate(magicLink, email),
      text: `Click this link to sign in to LetMeSell: ${magicLink}\n\nThis link will expire in 15 minutes.`,
    };

    if (this.initialized && this.transporter) {
      try {
        const info = await this.transporter.sendMail(emailContent);
        console.log(`[Email] ✓ Magic link sent to ${email}`);
        console.log(`[Email] Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } catch (error) {
        console.error('[Email] ✗ SMTP send error:', error);
        throw new Error(`Failed to send email: ${error.message}`);
      }
    } else {
      // Console logging for development
      console.log('\n========== EMAIL (Development Mode) ==========');
      console.log(`From: ${emailContent.from}`);
      console.log(`To: ${email}`);
      console.log(`Subject: ${emailContent.subject}`);
      console.log(`\nMagic Link: ${magicLink}`);
      console.log('\nTo enable real email sending, configure SMTP in .env:');
      console.log('  SMTP_HOST=smtp.gmail.com');
      console.log('  SMTP_PORT=587');
      console.log('  SMTP_USER=your-email@gmail.com');
      console.log('  SMTP_PASSWORD=your-app-password');
      console.log('  FROM_EMAIL=your-email@gmail.com');
      console.log('===============================================\n');
      return { success: true, mock: true, link: magicLink };
    }
  }

  getMagicLinkTemplate(magicLink, email) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to LetMeSell</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">LetMeSell</h1>
  </div>
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">Sign in to your account</h2>
    <p style="color: #666; font-size: 16px;">
      Click the button below to sign in to LetMeSell. This link will expire in 15 minutes.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${magicLink}" 
         style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Sign in to LetMeSell
      </a>
    </div>
    <p style="color: #999; font-size: 14px; margin-top: 30px;">
      Or copy and paste this link into your browser:<br>
      <a href="${magicLink}" style="color: #3b82f6; word-break: break-all;">${magicLink}</a>
    </p>
    <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
      If you didn't request this email, you can safely ignore it.
    </p>
  </div>
</body>
</html>
    `;
  }
}

module.exports = new EmailService();

