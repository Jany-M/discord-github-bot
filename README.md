# Discord GitHub Bot

A Discord bot that listens to GitHub webhook events (commits, pull requests, issues, releases) and posts formatted notifications to Discord channels.

![Alt text](https://i.postimg.cc/R0t0gHqW/preview.png "Discord Preview")


## What This App Does

This bot automatically notifies your Discord server about GitHub activity:

- **Real-time notifications** for commits, pull requests, issues, and releases
- **Beautiful Discord embeds** with rich formatting and metadata
- **Flexible filtering** by repository, branch, and event type
- **OAuth-based authentication** (no need to create personal access tokens manually)
- **Secure token storage** with AES-256-GCM encryption
- **Manual event replay** for testing or recovering failed webhooks
- **Multi-repository support** with channel routing

## Prerequisites

Before you begin, you'll need:

- **Node.js 18+** and npm
- **Discord server** with admin access
- **GitHub account** with repository access
- **For production**: Render.com account or similar hosting service

## Setup Steps

Follow these steps in order to set up the bot locally or in the cloud.

### Step 1: Clone and Install

```bash
git clone https://github.com/Jany-M/discord-github-bot.git
cd discord-github-bot
npm install
```

### Step 2: Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in all required variables. See the next sections for how to get each value.

**Required variables:**
- `DISCORD_BOT_TOKEN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_WEBHOOK_SECRET`
- `ENCRYPTION_KEY` (32+ characters)
- `BASE_URL`

**Optional variables:**
- `SESSION_SECRET` (auto-generated if not provided)
- `REDIS_URL` (required for production on Render, optional for local dev)
- `PORT` (defaults to 3000)
- `NODE_ENV` (defaults to development)

### Step 3: Generate Secrets

Generate random strings for the required secret values:

```bash
# Generate ENCRYPTION_KEY (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate GITHUB_WEBHOOK_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET (optional)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy these values into your `.env` file.

### Step 4: Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and give it a name (e.g., "GitHub Bot")
3. Go to the **Bot** section and click **Add Bot**
4. Under **TOKEN**, click **Reset Token** and copy it
5. Add this to your `.env` file as `DISCORD_BOT_TOKEN`
6. Enable these **Privileged Gateway Intents** (if needed):
   - Server Members Intent
7. Go to **OAuth2** → **URL Generator**
8. Select scopes: `bot`
9. Select permissions: `Send Messages`, `Embed Links`
10. Copy the generated URL and open it in your browser to invite the bot to your server

**To get your Discord Channel ID:**
1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click the channel and select **Copy Server ID** (or **Copy Channel ID** for text channels)

### Step 5: GitHub OAuth App Setup

This is different from webhook setup - it's for OAuth authentication.

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the form:
   - **Application name**: `Discord GitHub Bot` (or your choice)
   - **Homepage URL**: 
     - For local: `http://localhost:3000`
     - For ngrok: `https://your-ngrok-url.ngrok.io`
     - For Render: `https://your-app.onrender.com`
   - **Authorization callback URL**: 
     - For local: `http://localhost:3000/auth/github/callback`
     - For ngrok: `https://your-ngrok-url.ngrok.io/auth/github/callback`
     - For Render: `https://your-app.onrender.com/auth/github/callback`
   - **Description**: (Optional)
4. Click **Register application**
5. Copy the **Client ID** and generate a **Client Secret**
6. Add both to your `.env` file as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

### Step 6: Configuration File

Copy the example config:

```bash
cp config.example.json config.json
```

Edit `config.json` to specify which repositories to monitor and which Discord channels to post to:

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

### Step 7: GitHub Webhooks

For each repository you want to monitor:

1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. In the left sidebar, click **Webhooks**
4. Click **Add webhook**
5. Fill in the form:
   - **Payload URL**: `https://your-url/webhook/github`
     - Local: `https://your-ngrok-url.ngrok.io/webhook/github`
     - Render.com: `https://your-app.onrender.com/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: Enter your `GITHUB_WEBHOOK_SECRET` from `.env`
   - **Events**: Select:
     - ✅ Push
     - ✅ Pull requests
     - ✅ Issues
     - ✅ Releases
6. Leave **Active** checked
7. Click **Add webhook**

**Important:** The webhook secret must match exactly between your `.env` file and GitHub settings.

## Local Development

### Running Without Tunneling

For testing locally without external access:

```bash
npm run dev
```

This runs the bot on `http://localhost:3000`. The bot will work fine without Redis - it falls back to in-memory session storage.

Visit `http://localhost:3000/setup` to authorize the bot with GitHub.

### Running With ngrok (For Testing Webhooks)

To test webhook events locally, you need a tunnel to expose your local server:

1. **Install ngrok**: Download from [ngrok.com](https://ngrok.com/download)

2. **Start the bot**:
   ```bash
   npm run dev
   ```

3. **In a new terminal, start ngrok**:
   ```bash
   ngrok http 3000
   ```

4. **Copy the HTTPS URL** ngrok provides (e.g., `https://abc123.ngrok.io`)

5. **Update your `.env` file**:
   ```bash
   BASE_URL=https://abc123.ngrok.io
   ```

6. **Update GitHub OAuth App**:
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - Edit your OAuth App
   - Update **Authorization callback URL** to: `https://abc123.ngrok.io/auth/github/callback`

7. **Update GitHub webhook Payload URL** to: `https://abc123.ngrok.io/webhook/github`

8. **Complete OAuth setup** by visiting: `https://abc123.ngrok.io/setup`

**Note:** ngrok URLs change each restart. Free tier requires updating URLs each time. Upgrade to paid for permanent URLs.

## Cloud Deployment (Render)

### Step 1: Prepare Your Repository

1. Push your code to GitHub
2. Make sure all environment variables are properly documented in `.env.example`

### Step 2: Create a Web Service on Render

1. Go to [render.com](https://render.com) and sign up (use GitHub login)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `discord-github-bot`
   - **Language**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Click **Create Web Service**

### Step 3: Set Environment Variables

1. Go to your service on Render
2. Click **Environment** tab
3. Add all variables from your `.env` file:
   - `DISCORD_BOT_TOKEN`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GITHUB_WEBHOOK_SECRET`
   - `ENCRYPTION_KEY`
   - `BASE_URL` (you'll get your Render URL from the deployment)
   - `SESSION_SECRET`
   - `NODE_ENV=production`

Wait for the deployment to complete. Your Render URL will be something like `https://discord-github-bot-xxxxx.onrender.com`.

### Step 4: Create Redis Instance (For Session Storage)

1. Go to Render dashboard
2. Click **New +** → **Key Value** (Redis)
3. Fill in:
   - **Name**: `discord-bot-redis`
   - **Plan**: Free
   - **Region**: Match your service region (Frankfurt)
4. Click **Create**
5. Wait for it to be created
6. Copy the **Redis URL** (looks like `redis://default:password@hostname:port`)

### Step 5: Add Redis URL to Service

1. Go back to your `discord-github-bot` service
2. Click **Environment**
3. Add new variable:
   - **Key**: `REDIS_URL`
   - **Value**: Paste the Redis URL from step 4
4. Click **Save Changes**

The service will automatically redeploy with Redis support. Your OAuth flow will now work reliably across instances.

### Step 6: Update GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Edit your OAuth App
3. Update **Authorization callback URL** to: `https://your-render-url/auth/github/callback`

### Step 7: Complete OAuth Setup

1. Visit `https://your-render-url/setup`
2. Click **Authorize with GitHub**
3. Complete the authorization flow
4. You should see "Setup Complete!" message

### Step 8: Keep Service Awake (Prevent Free Tier Sleep)

The free tier on Render.com sleeps after 15 minutes of inactivity. To keep it running:

**Option 1: Use UptimeRobot (Recommended)**

1. Go to [uptimerobot.com](https://uptimerobot.com) and sign up
2. Click **Add Monitor**
3. Configure:
   - **Monitor Type**: HTTP (HTTPS)
   - **Friendly Name**: `Discord GitHub Bot`
   - **URL**: `https://your-render-url/health`
   - **Monitoring Interval**: 5 minutes
4. Click **Create Monitor**

This will ping your bot every 5 minutes to keep it awake.

**Option 2: Upgrade to Paid**

Purchase a paid plan on Render for always-on service.

### Step 9: Update GitHub Webhooks

For each repository, update the webhook:

1. Go to repository **Settings** → **Webhooks**
2. Edit your webhook
3. Update **Payload URL** to: `https://your-render-url/webhook/github`
4. Verify **Secret** matches `GITHUB_WEBHOOK_SECRET`
5. Save

## Features & Usage

### Manual Event Posting

If a webhook fails or you want to test, you can manually post events:

1. Visit `https://your-url/manual`
2. Enter repository, commit SHA, PR number, or issue number
3. Click the corresponding button to post to Discord

### Event Types

- **Push**: Commits to configured branches
- **Pull Requests**: Opened, closed, or updated
- **Issues**: Opened or closed
- **Releases**: Published releases

### Branch Filtering

Supports wildcards:
- `main` - exact branch name
- `*` - all branches
- `feature/*` - branches starting with "feature/"

## Security

- GitHub webhook signatures verified
- GitHub tokens encrypted with AES-256-GCM
- OAuth state prevents CSRF attacks
- All secrets in environment variables
- HTTPS required for production

## Development

Build and test:

```bash
# Install dependencies
npm install

# Run in development mode (auto-reload)
npm run dev

# Build TypeScript
npm run build

# Type check
npm run type-check
```

## Troubleshooting

### OAuth fails with "Invalid authorization state"

**Local development:**
- Make sure `BASE_URL` in `.env` matches your ngrok URL
- Check GitHub OAuth App callback URL is updated

**Render:**
- Verify `REDIS_URL` is set (required for multi-instance OAuth)
- Check Redis instance is running (status: Available)
- Verify `BASE_URL` environment variable is set

### Webhooks not received

1. Check webhook URL is correct in GitHub
2. Verify `GITHUB_WEBHOOK_SECRET` matches in both places
3. Check logs for signature verification errors

### Bot not responding in Discord

1. Verify bot is in the Discord server
2. Check bot has "Send Messages" and "Embed Links" permissions
3. Verify channel IDs are correct
4. Check logs for errors

### Token decryption errors

1. Ensure `ENCRYPTION_KEY` is 32+ characters
2. Don't change `ENCRYPTION_KEY` after storing token
3. To reset: delete `.github_token` and re-run OAuth setup

## Recommended Hosting

1. **Railway** - Best free option, generous monthly credit
2. **Render + UptimeRobot** - Free forever with uptime monitoring
3. **Fly.io** - Free always-on option (more complex setup)
