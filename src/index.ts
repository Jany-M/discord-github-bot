import express from 'express';
import dotenv from 'dotenv';
import { initializeDiscordBot } from './discord/bot';
import { initializeWebhooks, handleWebhook } from './github/webhook';
import { loadConfig } from './config/config';
import { hasStoredToken } from './github/oauth';
import setupRouter, { applySessionMiddleware } from './auth/setup';
import { logger } from './utils/logger';
import { postCommit, postPullRequest, postIssue } from './utils/manual-events';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));

// JSON parser for most routes
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get configured repositories
app.get('/api/repositories', (req, res) => {
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
app.get('/manual', (req, res) => {
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
app.post('/api/manual/commit/:owner/:repo/:sha', async (req, res) => {
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

app.post('/api/manual/pr/:owner/:repo/:number', async (req, res) => {
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

app.post('/api/manual/issue/:owner/:repo/:number', async (req, res) => {
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

// GitHub webhook endpoint (needs raw body for signature verification)
app.post('/webhook/github', express.raw({ type: 'application/json' }), async (req, res) => {
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
    if (!hasStoredToken()) {
      logger.warn('GitHub token not configured. Visit /setup to complete the OAuth flow.');
    }

    // Initialize Discord bot
    logger.info('Connecting to Discord...');
    await initializeDiscordBot(process.env.DISCORD_BOT_TOKEN!);

    // Initialize GitHub webhooks
    logger.info('Initializing GitHub webhooks...');
    initializeWebhooks(process.env.GITHUB_WEBHOOK_SECRET!);

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Setup wizard: http://localhost:${PORT}/setup`);
      logger.info(`Webhook endpoint: http://localhost:${PORT}/webhook/github`);
      
      if (!hasStoredToken()) {
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

