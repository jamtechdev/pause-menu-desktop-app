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
    const result = await authService.sendMagicLink(email, baseUrl);

    // Generate the magic link URL for the response (for development/testing)
    // The sendMagicLink now returns the token
    const magicLinkToken = result.token;
    // Add desktop_app=true parameter so server redirects to localhost callback
    const magicLinkUrl = `${baseUrl}/api/auth/verify?token=${magicLinkToken}&email=${encodeURIComponent(email)}&desktop_app=true`;

    res.json({
      success: true,
      message: 'Magic link sent to your email. Please check your inbox.',
      magicLinkUrl: magicLinkUrl, // Include link in response for development
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

    // Check if this is a desktop app request (has desktop_app=true query param)
    // If so, redirect to localhost callback server
    const isDesktopApp = req.query.desktop_app === 'true';
    
    if (isDesktopApp) {
      // Redirect to localhost callback server with token and email
      // Try port 8081 first, fallback to 8082 if needed
      const callbackPort = req.query.callback_port || '8081';
      const callbackUrl = `http://localhost:${callbackPort}/auth/callback?token=${encodeURIComponent(result.token)}&email=${encodeURIComponent(email)}`;
      console.log('[Auth] Desktop app detected, redirecting to:', callbackUrl);
      return res.redirect(callbackUrl);
    }

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
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 600px;
            width: 100%;
          }
          h1 { color: #333; margin-top: 0; }
          p { color: #666; margin: 10px 0; }
          .token-container {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
            text-align: left;
          }
          .token-label {
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
            font-size: 14px;
          }
          .token {
            word-break: break-all;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #333;
            background: white;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #ddd;
            margin-bottom: 15px;
            line-height: 1.6;
          }
          .copy-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
            width: 100%;
          }
          .copy-btn:hover {
            background: #2563eb;
          }
          .copy-btn:active {
            background: #1d4ed8;
          }
          .copy-btn.copied {
            background: #10b981;
          }
          .info {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
            text-align: left;
            border-radius: 4px;
          }
          .info p {
            margin: 5px 0;
            font-size: 13px;
            color: #1e40af;
          }
          .user-info {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: left;
          }
          .user-info p {
            margin: 5px 0;
            font-size: 13px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Sign in successful!</h1>
          <p>Your JWT authentication token has been generated.</p>
          
          <div class="token-container">
            <div class="token-label">JWT Token (Copy this for API testing):</div>
            <div class="token" id="token">${result.token}</div>
            <button class="copy-btn" onclick="copyToken()">📋 Copy Token</button>
          </div>

          <div class="info">
            <p><strong>ℹ️ Token Information:</strong></p>
            <p>• This token expires in 30 days</p>
            <p>• Use this token in the Authorization header: <code>Authorization: Bearer YOUR_TOKEN</code></p>
            <p>• Keep this page open until you've copied the token</p>
          </div>

          <div class="user-info">
            <p><strong>User Information:</strong></p>
            <p>Email: ${result.user.email}</p>
            <p>Name: ${result.user.name || 'N/A'}</p>
            <p>User ID: ${result.user.id || result.user._id || 'N/A'}</p>
          </div>

          <script>
            function copyToken() {
              const token = document.getElementById('token').textContent;
              navigator.clipboard.writeText(token).then(() => {
                const btn = document.querySelector('.copy-btn');
                const originalText = btn.textContent;
                btn.textContent = '✓ Copied!';
                btn.classList.add('copied');
                setTimeout(() => {
                  btn.textContent = originalText;
                  btn.classList.remove('copied');
                }, 2000);
              }).catch(err => {
                alert('Failed to copy. Please manually select and copy the token.');
              });
            }

            // Send token to parent window (for iframe embedding)
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: 'AUTH_SUCCESS',
                token: '${result.token}',
                user: ${JSON.stringify(result.user).replace(/'/g, "\\'")}
              }, '*');
            }
            
            // Also try to send token to desktop app via custom protocol or postMessage
            if (window.opener) {
              window.opener.postMessage({
                type: 'AUTH_SUCCESS',
                token: '${result.token}',
                user: ${JSON.stringify(result.user).replace(/'/g, "\\'")}
              }, '*');
            }

            // Auto-close after 3 seconds if in iframe
            if (window.parent && window.parent !== window) {
              setTimeout(() => {
                // The parent will handle closing
              }, 3000);
            }
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

