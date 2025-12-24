import express, { Request, Response } from 'express';
import session from 'express-session';
import crypto from 'crypto';
import { getAuthorizationUrl, exchangeCodeForToken, storeToken, hasStoredToken } from '../github/oauth';
import { logger } from '../utils/logger';

const router = express.Router();

// Session configuration
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

router.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 15, // 15 minutes
    },
  })
);

/**
 * Setup wizard page
 */
router.get('/setup', (req: Request, res: Response) => {
  if (hasStoredToken()) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GitHub Bot Setup - Already Configured</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .success {
              color: #28a745;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Setup Complete</h1>
            <p class="success">GitHub token is already configured.</p>
            <p>The bot is ready to receive webhook events.</p>
          </div>
        </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>GitHub Bot Setup</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          h1 {
            color: #333;
            margin-bottom: 20px;
          }
          p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 15px;
          }
          .button {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin-top: 20px;
            transition: background 0.2s;
          }
          .button:hover {
            background: #218838;
          }
          .info {
            background: #e7f3ff;
            border-left: 4px solid #0366d6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .scopes {
            background: #f6f8fa;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
          }
          .scopes ul {
            margin: 10px 0;
            padding-left: 20px;
          }
          .scopes li {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔧 GitHub Bot Setup</h1>
          <p>Welcome! Let's set up your GitHub integration.</p>
          
          <div class="info">
            <strong>What this does:</strong> This will authorize the bot to access your GitHub repositories
            so it can receive webhook events and post notifications to Discord.
          </div>

          <div class="scopes">
            <strong>Required Permissions:</strong>
            <ul>
              <li><strong>repo</strong> - Access to private repositories</li>
              <li><strong>read:org</strong> - Access to organization repositories</li>
              <li><strong>admin:repo_hook</strong> - Manage repository webhooks</li>
            </ul>
          </div>

          <p>Click the button below to authorize the bot with GitHub:</p>
          
          <a href="/auth/github" class="button">🔐 Authorize with GitHub</a>
        </div>
      </body>
    </html>
  `);
});

/**
 * Initiate GitHub OAuth flow
 */
router.get('/auth/github', (req: Request, res: Response) => {
  // Generate state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  (req.session as any).oauthState = state;

  try {
    const authUrl = getAuthorizationUrl(state);
    logger.info('Redirecting to GitHub OAuth');
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Failed to generate authorization URL:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Setup Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
            }
            .error {
              color: #d73a49;
              background: #ffeef0;
              padding: 15px;
              border-radius: 4px;
              border-left: 4px solid #d73a49;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Setup Error</h1>
            <p>Failed to initialize GitHub authorization. Please check your environment variables:</p>
            <ul>
              <li>GITHUB_CLIENT_ID</li>
              <li>GITHUB_CLIENT_SECRET</li>
              <li>BASE_URL</li>
            </ul>
          </div>
        </body>
      </html>
    `);
  }
});

/**
 * Handle GitHub OAuth callback
 */
router.get('/auth/github/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const sessionState = (req.session as any)?.oauthState;

  // Verify state to prevent CSRF attacks
  if (!state || state !== sessionState) {
    logger.warn('OAuth state mismatch - possible CSRF attack');
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authorization Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
            }
            .error {
              color: #d73a49;
              background: #ffeef0;
              padding: 15px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Authorization Failed</h1>
            <p>Invalid authorization state. Please try again.</p>
            <a href="/setup">← Back to Setup</a>
          </div>
        </body>
      </html>
    `);
  }

  // Clear the state from session
  delete (req.session as any).oauthState;

  if (!code || typeof code !== 'string') {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authorization Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
            }
            .error {
              color: #d73a49;
              background: #ffeef0;
              padding: 15px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Authorization Failed</h1>
            <p>No authorization code received from GitHub.</p>
            <a href="/setup">← Back to Setup</a>
          </div>
        </body>
      </html>
    `);
  }

  try {
    // Exchange code for token
    const token = await exchangeCodeForToken(code);
    
    // Store the token
    storeToken(token);

    logger.info('GitHub OAuth completed successfully');

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Setup Complete</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .success {
              color: #28a745;
              font-weight: bold;
              font-size: 18px;
            }
            .next-steps {
              background: #e7f3ff;
              border-left: 4px solid #0366d6;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .next-steps ol {
              margin: 10px 0;
              padding-left: 20px;
            }
            .next-steps li {
              margin: 8px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Setup Complete!</h1>
            <p class="success">GitHub authorization successful!</p>
            <p>Your GitHub token has been securely stored and encrypted.</p>
            
            <div class="next-steps">
              <strong>Next Steps:</strong>
              <ol>
                <li>Configure your <code>config.json</code> file with repositories and Discord channels</li>
                <li>Set up webhooks in your GitHub repositories pointing to: <code>${process.env.BASE_URL || 'YOUR_BASE_URL'}/webhook/github</code></li>
                <li>The bot will now receive and forward GitHub events to Discord!</li>
              </ol>
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('OAuth callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Setup Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
            }
            .error {
              color: #d73a49;
              background: #ffeef0;
              padding: 15px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Setup Error</h1>
            <p>Failed to complete authorization: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <a href="/setup">← Try Again</a>
          </div>
        </body>
      </html>
    `);
  }
});

export default router;

