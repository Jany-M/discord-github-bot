import express from 'express';
import dotenv from 'dotenv';
import { initializeDiscordBot } from './discord/bot';
import { initializeWebhooks, handleWebhook } from './github/webhook';
import { loadConfig } from './config/config';
import { hasStoredToken, getStoredToken } from './github/oauth';
import setupRouter, { applySessionMiddleware } from './auth/setup';
import { logger } from './utils/logger';
import { postCommit, postPullRequest, postIssue } from './utils/manual-events';
import { initializeRedisClient } from './utils/redis';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required for HTTPS detection through reverse proxies (e.g., Render's proxy)
app.set('trust proxy', 1);

// GitHub webhook endpoint (needs raw body for signature verification)
// MUST be before express.json() middleware to get raw body
app.post('/webhook/github', express.raw({ 
  type: 'application/json',
  limit: '10mb' // Increase limit for large webhook payloads
}), async (req: express.Request, res: express.Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    const deliveryId = req.headers['x-github-delivery'] as string;

    if (!signature || !event || !deliveryId) {
      logger.warn('Missing required webhook headers');
      return res.status(400).json({ error: 'Missing required headers' });
    }

    logger.debug(`Received webhook: ${event} (${deliveryId})`);

    // Get raw body as string for signature verification
    const rawBody = (req.body as Buffer).toString('utf8');
    // Parse JSON payload
    const payload = JSON.parse(rawBody);

    // Handle the webhook (pass raw body for signature verification)
    await handleWebhook(deliveryId, event, payload, signature, rawBody);

    res.status(200).json({ received: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Webhook processing error:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    });
    res.status(500).json({ 
      error: 'Webhook processing failed',
      message: errorMessage
    });
  }
});

// Middleware
app.use(express.urlencoded({ extended: true }));

// JSON parser for most routes
app.use(express.json());

// Root route - show landing page if setup is done, otherwise redirect to setup
app.get('/', async (req: express.Request, res: express.Response) => {
  const isSetupComplete = await hasStoredToken();
  
  if (!isSetupComplete) {
    return res.redirect('/setup');
  }

  // Setup is complete - show landing page with README info
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Discord GitHub Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            padding: 40px;
          }
          h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 2.5em;
          }
          .subtitle {
            color: #666;
            font-size: 1.2em;
            margin-bottom: 30px;
          }
          .github-link {
            display: inline-block;
            background: #24292e;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
            margin-bottom: 30px;
            transition: background 0.3s;
          }
          .github-link:hover {
            background: #2f363d;
          }
          .features {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin: 30px 0;
          }
          @media (max-width: 900px) {
            .features {
              grid-template-columns: repeat(2, 1fr);
            }
          }
          @media (max-width: 600px) {
            .features {
              grid-template-columns: 1fr;
            }
          }
          .feature {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
          }
          .feature h3 {
            color: #667eea;
            margin-bottom: 10px;
          }
          .endpoints {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #eee;
          }
          .endpoints h2 {
            color: #667eea;
            margin-bottom: 15px;
          }
          .setup-guide {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #667eea;
          }
          .setup-guide h3 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.3em;
          }
          .setup-guide ol {
            margin-left: 20px;
          }
          .setup-guide li {
            margin: 10px 0;
            line-height: 1.6;
          }
          .setup-guide code {
            background: #e9ecef;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
          }
          .setup-guide a {
            color: #667eea;
            text-decoration: none;
            font-weight: bold;
          }
          .setup-guide a:hover {
            text-decoration: underline;
          }
          .endpoint-link {
            display: inline-block;
            color: #667eea;
            text-decoration: none;
            margin: 5px 10px 5px 0;
            padding: 8px 16px;
            background: #f0f0f0;
            border-radius: 4px;
            transition: background 0.3s;
          }
          .endpoint-link:hover {
            background: #e0e0e0;
          }
          .status {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 0.9em;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <span class="status">✅ Setup Complete</span>
          <h1>Discord GitHub Bot</h1>
          <p class="subtitle">A Discord bot that listens to GitHub webhook events and posts formatted notifications to Discord channels.</p>

          <h4><a href="https://github.com/Jany-M/" class="github-link" target="_blank">
            👩🏻‍💻 Author
          </a></a>
          
          <a href="https://github.com/Jany-M/discord-github-bot" class="github-link" target="_blank">
            📦 View on GitHub
          </a>
          
          <div class="features">
            <div class="feature">
              <h3>🔔 Real-time Notifications</h3>
              <p>Get instant notifications for commits, pull requests, issues, and releases.</p>
            </div>
            <div class="feature">
              <h3>🎨 Beautiful Embeds</h3>
              <p>Rich Discord embeds with formatting and metadata.</p>
            </div>
            <div class="feature">
              <h3>🔒 Secure</h3>
              <p>OAuth-based authentication with encrypted token storage.</p>
            </div>
            <div class="feature">
              <h3>⚙️ Flexible</h3>
              <p>Filter by repository, branch, and event type with channel routing.</p>
            </div>
          </div>
          
          <div class="endpoints">
            <h2>Available Endpoints</h2>
            <a href="/setup" class="endpoint-link">Setup Wizard</a>
            <a href="/health" class="endpoint-link">Health Check</a>
            <a href="/manual" class="endpoint-link">Manual Events</a>
            <a href="/api/repositories" class="endpoint-link">API: Repositories</a>
            
            <div class="setup-guide">
              <h3>🚀 Quick Setup Guide</h3>
              <ol>
                <li><strong>Fork & Clone:</strong> Fork the <a href="https://github.com/Jany-M/discord-github-bot" target="_blank">repository</a> to your GitHub account, then clone and run <code>npm install</code></li>
                <li><strong>Environment Variables:</strong> Copy <code>.env.example</code> to <code>.env</code> and fill in required values</li>
                <li><strong>Discord Bot:</strong> Create a bot at <a href="https://discord.com/developers/applications" target="_blank">Discord Developer Portal</a> and get your bot token</li>
                <li><strong>GitHub OAuth App:</strong> Create an OAuth App in <a href="https://github.com/settings/developers" target="_blank">GitHub Settings</a> for authentication</li>
                <li><strong>Generate Secrets:</strong> Run <code>node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code> for encryption keys</li>
                <li><strong>Local Testing:</strong> Use <a href="https://ngrok.com" target="_blank">ngrok</a> to expose your local server for webhook testing</li>
                <li><strong>Deploy:</strong> Deploy to <a href="https://render.com" target="_blank">Render</a> or any cloud service (remember to set up Redis for session storage)</li>
                <li><strong>Configure Webhooks:</strong> Add webhook URL (<code>YOUR_URL/webhook/github</code>) to your GitHub repository settings</li>
              </ol>
              <p style="margin-top: 15px;"><strong>📖 Full documentation:</strong> <a href="https://github.com/Jany-M/discord-github-bot#readme" target="_blank">View README on GitHub</a></p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get configured repositories
app.get('/api/repositories', (req: express.Request, res: express.Response) => {
  try {
    const config = loadConfig();
    const repositories = config.repositories.map(repo => repo.name);
    res.json({ repositories });
  } catch (error) {
    logger.error('Failed to load repositories:', error);
    res.status(500).json({ error: 'Failed to load repositories' });
  }
});

// Manual event posting endpoints
app.get('/manual', (req: express.Request, res: express.Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Manual Event Posting</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
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
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #555;
          }
          input, select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
          }
          button {
            background: #28a745;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            font-size: 16px;
            margin-right: 10px;
          }
          button:hover {
            background: #218838;
          }
          .info {
            background: #e7f3ff;
            border-left: 4px solid #0366d6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .success {
            background: #d4edda;
            border-left: 4px solid #28a745;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #155724;
          }
          .error {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #721c24;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔧 Manual Event Posting</h1>
          <p>Use this tool to manually post GitHub events to Discord (useful for replaying failed webhooks).</p>
          
          <div class="info">
            <strong>Format:</strong> Repository should be in format <code>owner/repo</code> (e.g., <code>Jany-M/discord-github-bot</code>)
          </div>

          <div class="form-group" style="margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-radius: 4px;">
            <label for="repoSelector" style="font-weight: bold; margin-bottom: 10px; display: block;">📦 Quick Select Repository:</label>
            <select id="repoSelector" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
              <option value="">-- Select a repository from config.json --</option>
            </select>
            <small style="color: #666; display: block; margin-top: 5px;">Or type manually in the fields below</small>
          </div>

          <form id="commitForm" style="margin-bottom: 30px; padding-bottom: 30px; border-bottom: 2px solid #eee;">
            <h2>Post Commit</h2>
            <div class="form-group">
              <label>Repository (owner/repo):</label>
              <input type="text" name="repo" id="commitRepo" placeholder="Jany-M/discord-github-bot" required>
            </div>
            <div class="form-group">
              <label>Commit SHA:</label>
              <input type="text" name="sha" placeholder="abc123def456..." required>
            </div>
            <button type="submit">📝 Post Commit</button>
          </form>

          <form id="prForm" style="margin-bottom: 30px; padding-bottom: 30px; border-bottom: 2px solid #eee;">
            <h2>Post Pull Request</h2>
            <div class="form-group">
              <label>Repository (owner/repo):</label>
              <input type="text" name="repo" id="prRepo" placeholder="Jany-M/discord-github-bot" required>
            </div>
            <div class="form-group">
              <label>PR Number:</label>
              <input type="number" name="number" placeholder="123" required>
            </div>
            <button type="submit">🔄 Post Pull Request</button>
          </form>

          <form id="issueForm">
            <h2>Post Issue</h2>
            <div class="form-group">
              <label>Repository (owner/repo):</label>
              <input type="text" name="repo" id="issueRepo" placeholder="Jany-M/discord-github-bot" required>
            </div>
            <div class="form-group">
              <label>Issue Number:</label>
              <input type="number" name="number" placeholder="456" required>
            </div>
            <button type="submit">📋 Post Issue</button>
          </form>

          <div id="result"></div>
        </div>

        <script>
          // Load repositories from config
          async function loadRepositories() {
            try {
              const response = await fetch('/api/repositories');
              const data = await response.json();
              const selector = document.getElementById('repoSelector');
              
              if (data.repositories && data.repositories.length > 0) {
                data.repositories.forEach(repo => {
                  const option = document.createElement('option');
                  option.value = repo;
                  option.textContent = repo;
                  selector.appendChild(option);
                });
              } else {
                selector.innerHTML = '<option value="">No repositories configured</option>';
              }
            } catch (error) {
              console.error('Failed to load repositories:', error);
              document.getElementById('repoSelector').innerHTML = '<option value="">Error loading repositories</option>';
            }
          }

          // Update all repo fields when selector changes
          document.getElementById('repoSelector').addEventListener('change', (e) => {
            const selectedRepo = e.target.value;
            if (selectedRepo) {
              document.getElementById('commitRepo').value = selectedRepo;
              document.getElementById('prRepo').value = selectedRepo;
              document.getElementById('issueRepo').value = selectedRepo;
            }
          });

          // Load repositories on page load
          loadRepositories();

          function showResult(message, isError = false) {
            const resultDiv = document.getElementById('result');
            resultDiv.className = isError ? 'error' : 'success';
            resultDiv.innerHTML = message;
            resultDiv.scrollIntoView({ behavior: 'smooth' });
          }

          document.getElementById('commitForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const repo = formData.get('repo');
            const sha = formData.get('sha');
            const [owner, repoName] = repo.split('/');
            
            if (!owner || !repoName) {
              showResult('Invalid repository format. Use owner/repo', true);
              return;
            }

            try {
              const response = await fetch(\`/api/manual/commit/\${owner}/\${repoName}/\${sha}\`, { method: 'POST' });
              const data = await response.json();
              if (response.ok) {
                showResult(\`✅ Successfully posted commit \${sha} to Discord!\`);
              } else {
                showResult(\`❌ Error: \${data.error || 'Unknown error'}\`, true);
              }
            } catch (error) {
              showResult(\`❌ Error: \${error.message}\`, true);
            }
          });

          document.getElementById('prForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const repo = formData.get('repo');
            const number = formData.get('number');
            const [owner, repoName] = repo.split('/');
            
            if (!owner || !repoName) {
              showResult('Invalid repository format. Use owner/repo', true);
              return;
            }

            try {
              const response = await fetch(\`/api/manual/pr/\${owner}/\${repoName}/\${number}\`, { method: 'POST' });
              const data = await response.json();
              if (response.ok) {
                showResult(\`✅ Successfully posted PR #\${number} to Discord!\`);
              } else {
                showResult(\`❌ Error: \${data.error || 'Unknown error'}\`, true);
              }
            } catch (error) {
              showResult(\`❌ Error: \${error.message}\`, true);
            }
          });

          document.getElementById('issueForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const repo = formData.get('repo');
            const number = formData.get('number');
            const [owner, repoName] = repo.split('/');
            
            if (!owner || !repoName) {
              showResult('Invalid repository format. Use owner/repo', true);
              return;
            }

            try {
              const response = await fetch(\`/api/manual/issue/\${owner}/\${repoName}/\${number}\`, { method: 'POST' });
              const data = await response.json();
              if (response.ok) {
                showResult(\`✅ Successfully posted issue #\${number} to Discord!\`);
              } else {
                showResult(\`❌ Error: \${data.error || 'Unknown error'}\`, true);
              }
            } catch (error) {
              showResult(\`❌ Error: \${error.message}\`, true);
            }
          });
        </script>
      </body>
    </html>
  `);
});

// API endpoints for manual event posting
app.post('/api/manual/commit/:owner/:repo/:sha', async (req: express.Request, res: express.Response) => {
  try {
    const { owner, repo, sha } = req.params;
    await postCommit(owner, repo, sha);
    res.json({ success: true, message: `Commit ${sha} posted to Discord` });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Manual commit posting failed:', error);
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/manual/pr/:owner/:repo/:number', async (req: express.Request, res: express.Response) => {
  try {
    const { owner, repo, number } = req.params;
    await postPullRequest(owner, repo, parseInt(number));
    res.json({ success: true, message: `PR #${number} posted to Discord` });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Manual PR posting failed:', error);
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/manual/issue/:owner/:repo/:number', async (req: express.Request, res: express.Response) => {
  try {
    const { owner, repo, number } = req.params;
    await postIssue(owner, repo, parseInt(number));
    res.json({ success: true, message: `Issue #${number} posted to Discord` });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Manual issue posting failed:', error);
    res.status(500).json({ error: errorMessage });
  }
});

// Start server
async function start() {
  try {
    // Check for required environment variables
    const requiredEnvVars = [
      'DISCORD_BOT_TOKEN',
      'GITHUB_CLIENT_ID',
      'GITHUB_CLIENT_SECRET',
      'GITHUB_WEBHOOK_SECRET',
      'ENCRYPTION_KEY',
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      logger.info('Please check your .env file or environment variables');
      process.exit(1);
    }

    // Validate encryption key length
    if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
      logger.error('ENCRYPTION_KEY must be at least 32 characters long');
      process.exit(1);
    }

    // Initialize Redis for persistent token storage
    logger.info('Initializing Redis...');
    await initializeRedisClient();

    // Load stored GitHub token from Redis if available
    try {
      const token = await getStoredToken();
      if (token) {
        logger.info('GitHub token loaded from persistent storage');
      }
    } catch (error) {
      logger.warn('Could not load GitHub token:', error);
    }

    // Initialize session middleware (must be before routes)
    logger.info('Initializing session storage...');
    await applySessionMiddleware(app);

    // Setup wizard routes (after session middleware)
    app.use('/', setupRouter);

    // Load configuration
    try {
      loadConfig();
    } catch (error) {
      logger.warn('Configuration file not found or invalid:', error);
      logger.info('The bot will still start, but you need to configure it before it can process events');
    }

    // Check if GitHub token is configured
    if (!(await hasStoredToken())) {
      logger.warn('GitHub token not configured. Visit /setup to complete the OAuth flow.');
    }

    // Initialize Discord bot
    logger.info('Connecting to Discord...');
    await initializeDiscordBot(process.env.DISCORD_BOT_TOKEN!);

    // Initialize GitHub webhooks
    logger.info('Initializing GitHub webhooks...');
    initializeWebhooks(process.env.GITHUB_WEBHOOK_SECRET!);

    // Start Express server
    app.listen(PORT, async () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Setup wizard: http://localhost:${PORT}/setup`);
      logger.info(`Webhook endpoint: http://localhost:${PORT}/webhook/github`);
      
      if (!(await hasStoredToken())) {
        logger.info('');
        logger.info('⚠️  GitHub token not configured!');
        logger.info(`   Visit http://localhost:${PORT}/setup to complete setup`);
        logger.info('');
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the application
start();

