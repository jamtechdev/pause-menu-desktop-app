// Authentication routes

const express = require('express');
const router = express.Router();
const authService = require('../services/auth');

/**
 * POST /api/auth/login
 * Request magic link login
 */
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
      });
    }

    const baseUrl = req.protocol + '://' + req.get('host');
    await authService.sendMagicLink(email, baseUrl);

    res.json({
      success: true,
      message: 'Magic link sent to your email. Please check your inbox.',
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send magic link',
    });
  }
});

/**
 * POST /api/auth/verify
 * Verify magic link token and create session
 */
router.post('/verify', async (req, res) => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        message: 'Token and email are required',
      });
    }

    const result = await authService.verifyAndCreateSession(token, email);

    res.json({
      success: true,
      user: result.user,
      token: result.token,
      message: 'Authentication successful',
    });
  } catch (error) {
    console.error('[Auth] Verify error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Invalid or expired token',
    });
  }
});

/**
 * GET /api/auth/verify
 * Verify magic link token via query parameters (for browser redirect)
 */
router.get('/verify', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Invalid Link</h1>
            <p>This magic link is invalid or missing required parameters.</p>
          </body>
        </html>
      `);
    }

    const result = await authService.verifyAndCreateSession(token, email);

    // Return HTML page that can communicate with desktop app
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sign in successful - LetMeSell</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
          }
          h1 { color: #333; margin-top: 0; }
          p { color: #666; }
          .token {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 6px;
            word-break: break-all;
            font-family: monospace;
            font-size: 12px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Sign in successful!</h1>
          <p>You can close this window and return to the LetMeSell app.</p>
          <p>The authentication token has been generated.</p>
          <div class="token">Token: ${result.token.substring(0, 50)}...</div>
          <script>
            // Try to send token to desktop app via custom protocol or postMessage
            if (window.opener) {
            window.opener.postMessage({
              type: 'AUTH_SUCCESS',
              token: '${result.token}',
              user: ${JSON.stringify(result.user).replace(/'/g, "\\'")}
            }, '*');
            }
            // Auto-close after 3 seconds
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('[Auth] Verify error:', error);
    res.status(400).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Authentication Failed</h1>
          <p>${error.message || 'Invalid or expired token'}</p>
          <p>Please request a new magic link.</p>
        </body>
      </html>
    `);
  }
});

module.exports = router;

