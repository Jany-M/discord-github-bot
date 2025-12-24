# Discord GitHub Bot

A Discord bot that listens to GitHub webhook events (commits, pull requests, issues, releases) and posts formatted notifications to Discord channels.

## Features

- 🔔 Real-time notifications for GitHub events
- 🎨 Beautiful Discord embeds with rich formatting
- 🔐 Secure OAuth-based GitHub authentication (no manual token creation)
- 🔒 Encrypted token storage
- ⚙️ Flexible configuration for multiple repositories and branches
- 🎯 Event filtering (push, pull_request, issues, release)
- 🌿 Branch filtering with wildcard support
- 🔄 Manual event replay system (for failed webhooks or testing)

## Prerequisites

- Node.js 18+ and npm
- A Discord bot token
- A GitHub OAuth App (for easy authentication)
- A GitHub webhook secret

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd discord-github-bot
npm install
```

### 2. Environment Setup

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` and set the following:

- `DISCORD_BOT_TOKEN` - Your Discord bot token (see [Discord Bot Setup](#discord-bot-setup))
- `GITHUB_CLIENT_ID` - Your GitHub OAuth App client ID (see [GitHub OAuth App Setup](#github-oauth-app-setup))
- `GITHUB_CLIENT_SECRET` - Your GitHub OAuth App client secret
- `GITHUB_WEBHOOK_SECRET` - A random secret for webhook verification (see below)
- `ENCRYPTION_KEY` - A random 32+ character string for token encryption (see below)
- `BASE_URL` - Your public URL (e.g., `https://your-bot.railway.app` or `http://localhost:3000` for local)
- `SESSION_SECRET` - A random secret for session management (see below)

**Generate secrets (run these commands to create secure random strings):**

```bash
# Generate GITHUB_WEBHOOK_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Important:** 
- `GITHUB_WEBHOOK_SECRET` must be the same value in both your `.env` file AND in the GitHub webhook settings (when you create the webhook in step 6)
- These are just random strings you create - GitHub doesn't provide them

### 3. Configuration

Copy the example config file:

```bash
cp config.example.json config.json
```

Edit `config.json` to configure which repositories and events to monitor:

```json
{
  "discord": {
    "channels": {
      "default": "YOUR_DEFAULT_DISCORD_CHANNEL_ID",
      "repositories": {
        "owner/repo": "SPECIFIC_CHANNEL_ID_FOR_REPO"
      }
    }
  },
  "repositories": [
    {
      "name": "owner/repo",
      "events": ["push", "pull_request", "issues", "release"],
      "branches": ["main", "develop", "*"],
      "channel": "OPTIONAL_CHANNEL_OVERRIDE"
    }
  ]
}
```

### 4. Build and Run

```bash
# Build TypeScript
npm run build

# Run the bot
npm start

# Or run in development mode (with auto-reload)
npm run dev
```

### 5. Complete GitHub OAuth Setup

1. Start the bot and visit `http://localhost:3000/setup` (or your deployed URL)
2. Click "Authorize with GitHub"
3. Authorize the application on GitHub
4. You'll be redirected back and the token will be stored automatically

### 6. Set Up GitHub Webhooks

**This is separate from OAuth App setup!** This configures webhooks in each repository you want to monitor.

For each repository you want to monitor:

1. Go to your repository on GitHub (e.g., `https://github.com/username/repo`)
2. Click on **Settings** (top menu bar of the repository)
3. In the left sidebar, click **Webhooks**
4. Click **Add webhook** button
5. Fill in the webhook form:
   - **Payload URL**: 
     - For local: `https://your-ngrok-url.ngrok.io/webhook/github` (see [Local Development](#local-development-with-tunneling) below)
     - For deployed: `https://your-bot-url/webhook/github`
   - **Content type**: Select `application/json`
   - **Secret**: Enter the same value as `GITHUB_WEBHOOK_SECRET` from your `.env` file
     - **Where to get it:** Generate it yourself using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (see step 2 above)
     - **Important:** This must match exactly! Copy the value from your `.env` file and paste it here
     - This secret is used to verify that webhook requests are actually from GitHub
   - **Which events would you like to trigger this webhook?**: Select:
     - ✅ **Just the push event** (or select "Let me select individual events" and check):
       - ✅ Push
       - ✅ Pull requests
       - ✅ Issues
       - ✅ Releases
6. Leave **Active** checkbox checked
7. Click **Add webhook**

**Note:** You need to set up a webhook for each repository you want to monitor. The Payload URL is where GitHub will send webhook events.

## Local Development with Tunneling

When running the bot locally, GitHub can't reach `localhost` directly. You need to use a tunneling service to expose your local server to the internet.

### Option 1: ngrok (Recommended)

1. **Install ngrok**: Download from [ngrok.com](https://ngrok.com/download) or install via package manager:
   ```bash
   # Windows (via Chocolatey)
   choco install ngrok
   
   # Or download from ngrok.com
   ```

2. **Start your bot**:
   ```bash
   npm run dev
   ```

3. **In a separate terminal, start ngrok** (use the same port as your bot):
   ```bash
   ngrok http 3000
   ```
   **Note:** The port number (3000) must match the `PORT` in your `.env` file. If your bot runs on a different port, use that port number instead.

4. **Copy the HTTPS URL** ngrok provides (e.g., `https://abc123.ngrok.io`)

5. **Update your `.env` file**:
   ```bash
   BASE_URL=https://abc123.ngrok.io
   ```

6. **Update your GitHub OAuth App** callback URL to: `https://abc123.ngrok.io/auth/github/callback`

7. **Set webhook Payload URL** to: `https://abc123.ngrok.io/webhook/github`

**Note**: The ngrok URL changes each time you restart ngrok (unless you have a paid plan). You'll need to update the webhook URL each time.

### Option 2: Cloudflare Tunnel (cloudflared)

1. **Install cloudflared**: Download from [developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)

2. **Start your bot**:
   ```bash
   npm run dev
   ```

3. **In a separate terminal, start tunnel**:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

4. **Use the provided URL** (similar to ngrok)

### Option 3: localtunnel

1. **Install localtunnel**:
   ```bash
   npm install -g localtunnel
   ```

2. **Start your bot**:
   ```bash
   npm run dev
   ```

3. **In a separate terminal, start tunnel**:
   ```bash
   lt --port 3000
   ```

4. **Use the provided URL**

### Quick Local Development Setup

1. Start the bot: `npm run dev`
2. Start ngrok: `ngrok http 3000`
3. Copy the ngrok HTTPS URL
4. Update `.env`: `BASE_URL=https://your-ngrok-url.ngrok.io`
5. Update GitHub OAuth App callback URL
6. Set webhook Payload URL to: `https://your-ngrok-url.ngrok.io/webhook/github`
7. Visit `https://your-ngrok-url.ngrok.io/setup` to complete OAuth

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and give it a name
3. Go to **Bot** section
4. Click **Add Bot** and confirm
5. Under **Token**, click **Reset Token** and copy it (this is your `DISCORD_BOT_TOKEN`)
6. Enable the following **Privileged Gateway Intents**:
   - ✅ Server Members Intent (if needed)
7. Go to **OAuth2** → **URL Generator**
8. Select scopes: `bot`
9. Select bot permissions: `Send Messages`, `Embed Links`
10. Copy the generated URL and open it in your browser to invite the bot to your server

**To get a Discord Channel ID:**
1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click on the channel → **Copy ID**

## GitHub OAuth App Setup

**This is different from webhook setup!** This creates the OAuth app for authentication.

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the form:
   - **Application name**: `Discord GitHub Bot` (or your choice)
   - **Homepage URL**: 
     - For local: `http://localhost:3000` (or your ngrok URL if using tunneling)
     - For deployed: Your bot's public URL (e.g., `https://your-app.railway.app`)
   - **Authorization callback URL**: 
     - For local: `http://localhost:3000/auth/github/callback` (or `https://your-ngrok-url.ngrok.io/auth/github/callback` if using ngrok)
     - For deployed: `https://your-bot-url/auth/github/callback`
   - **Application description**: (Optional) Description of your bot
4. Click **Register application**
5. On the next page, copy the **Client ID** and generate a **Client secret**
6. Add both to your `.env` file:
   ```
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   ```

**Note:** The OAuth flow handles token creation automatically - you don't need to create a personal access token manually!

**Important:** Webhook setup (step 6 below) is a separate process that happens in your repository settings, not here!

## Configuration Reference

### Repository Configuration

Each repository in the `repositories` array supports:

- `name` (required): Repository in format `owner/repo`
- `events` (required): Array of event types: `push`, `pull_request`, `issues`, `release`
- `branches` (required): Array of branch names or `"*"` for all branches
  - Supports wildcards: `"feature/*"` matches all branches starting with `feature/`
- `channel` (optional): Override Discord channel for this repository

### Channel Resolution

The bot resolves Discord channels in this order:
1. Repository-specific `channel` override (if set)
2. `discord.channels.repositories[repoName]` (if set)
3. `discord.channels.default` (fallback)

## Event Types

### Push Events
- Triggered on commits to configured branches
- Shows commit count, latest commit message, author, branch, and statistics
- Manual events include added/removed lines (e.g., `+150 -50 (200 total)`)

### Pull Request Events
- `opened`: New PR created
- `closed`: PR closed (merged or not)
- `synchronize`: New commits added to PR

### Issue Events
- `opened`: New issue created
- `closed`: Issue closed

### Release Events
- `published`: New release published
- Shows release tag, name, notes, and author

## Manual Event Posting

If a webhook fails or you need to replay an event, you can manually post events to Discord using the built-in manual event system.

### Web Interface

1. Visit `http://localhost:3000/manual` (or your deployed URL)
2. Use the forms to post:
   - **Commits**: Enter repository (e.g., `owner/repo`) and commit SHA
   - **Pull Requests**: Enter repository and PR number
   - **Issues**: Enter repository and issue number
3. Click the respective button to post to Discord

The manual system will:
- Fetch the latest data from GitHub
- Format it the same way as webhook events
- Post to the configured Discord channel
- Show commit statistics (added/removed lines) when available

### API Endpoints

You can also use the API endpoints programmatically:

**Post a commit:**
```bash
POST /api/manual/commit/:owner/:repo/:sha

# Example:
POST /api/manual/commit/Jany-M/discord-github-bot/501d406
```

**Post a pull request:**
```bash
POST /api/manual/pr/:owner/:repo/:number

# Example:
POST /api/manual/pr/Jany-M/discord-github-bot/123
```

**Post an issue:**
```bash
POST /api/manual/issue/:owner/:repo/:number

# Example:
POST /api/manual/issue/Jany-M/discord-github-bot/456
```

**Using curl:**
```bash
# Post a commit
curl -X POST http://localhost:3000/api/manual/commit/Jany-M/discord-github-bot/501d406

# Post a PR
curl -X POST http://localhost:3000/api/manual/pr/Jany-M/discord-github-bot/123

# Post an issue
curl -X POST http://localhost:3000/api/manual/issue/Jany-M/discord-github-bot/456
```

**Note:** Manual events include enhanced information like commit statistics (added/removed lines) and better branch detection, since they fetch full details from the GitHub API.

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with auto-reload)
npm run dev

# Build TypeScript
npm run build

# Type check
npm run type-check
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for free hosting services like Railway, Render, and Fly.io.

## Security

- GitHub webhook signatures are verified
- Tokens are encrypted at rest using AES-256-GCM
- OAuth state parameter prevents CSRF attacks
- All secrets stored in environment variables
- Session management for OAuth flow

## Troubleshooting

### Bot doesn't respond to webhooks

1. Check that the webhook URL is correct in GitHub
2. Verify `GITHUB_WEBHOOK_SECRET` matches in both `.env` and GitHub webhook settings
3. Check bot logs for errors
4. Ensure the repository is configured in `config.json`

### Discord messages not sending

1. Verify `DISCORD_BOT_TOKEN` is correct
2. Check that the bot is in the Discord server
3. Verify channel IDs are correct (enable Developer Mode to copy IDs)
4. Check bot permissions in the channel

### OAuth setup fails

1. Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correct
2. Check that `BASE_URL` matches your OAuth app's callback URL
3. Ensure the callback URL in GitHub OAuth app settings matches exactly

### Token decryption errors

1. Ensure `ENCRYPTION_KEY` is at least 32 characters
2. Don't change `ENCRYPTION_KEY` after storing a token (you'll need to re-authenticate)
3. If you need to reset, delete `.github_token` and re-run OAuth setup


