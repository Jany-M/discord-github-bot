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

![Alt text](https://i.postimg.cc/QdCXmfVn/preview.png "API Preview")

## Prerequisites

- **Discord server** with admin access
- **GitHub account** with repository access
- **For production**: [render.com](https://render.com) free account or similar cloud hosting service
- **For testing locally**: [ngrok.com](https://ngrok.com/download)


## Setup Steps

Follow these steps in order to set up the bot locally or in the cloud.

### Step 1: Fork, Clone and Install

**Important:** You need to fork this repository to your own GitHub account first, as Render (and most cloud services) require access to your own repository for deployment.

1. **Fork the repository:**
   - Go to [https://github.com/Jany-M/discord-github-bot](https://github.com/Jany-M/discord-github-bot)
   - Click the **Fork** button in the top right
   - This creates a copy in your GitHub account

2. **Clone your forked repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/discord-github-bot.git
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
- `SESSION_SECRET` (auto-generated if not provided)
- `BASE_URL`

**Optional variables:**
- `REDIS_URL` (required for production on Render, optional for local dev)
- `PORT` (defaults to 3000)
- `NODE_ENV` (defaults to development)

### Step 3: Generate Secrets

Generate random strings for the required secret values (`ENCRYPTION_KEY`, `GITHUB_WEBHOOK_SECRET`, `SESSION_SECRET`):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" # 32+ characters
```

Copy these values into your `.env` file.

### Step 4

## Local Development

To test webhook events locally, you need a tunnel to expose your local server:

1. **Log in and install ngrok**: Log into [ngrok.com](https://ngrok.com/) and [download/install](https://ngrok.com/download) it.

2. **Start the bot**:
   ```bash
   npm run dev
   ```

3. **In a separate terminal, start ngrok**:
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

## Cloud Deployment

I am using a Free plan on [render.com](https://render.com), you can use any cloud service you like.

**Prepare Your Repository**

1. Push this forked repo to your own Github repo.

**Create a Web Service on Render**

1. Go to [render.com](https://render.com) and sign up (use GitHub login)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `discord-github-bot`
   - **Language**: `Node`
   - **Region**: any you want, but remember which one it is for later
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Click **Create Web Service**
6. Click on **Manual Deploy** (top right button), deployment *will fail* but will generate the public url we need to complete the environment setup.
7. At the top of the page you will now see your Render URL (something like `https://discord-github-bot-xxxxx.onrender.com`), this is the url you will need as `BASE_URL` in your `.env` and for all other urls (Discord App and GitHub Webhook)

**Create Redis Instance** (For Session Storage, otherwise the Github OAuth flow and app setup will break)

1. Go to Render dashboard
2. Click **New +** → **Key Value** (Redis)
3. Fill in:
   - **Name**: `discord-bot-redis`
   - **Plan**: Free
   - **Region**: Same as the Web Service region (both the Web Service and Key Value instances must be on e.g. Frankfurt)
4. Click **Create**
5. Wait for it to be created
6. Copy the **Redis URL** (looks like `redis://default:password@hostname:port`)

**Add Redis URL to Service**

1. Go back to your `discord-github-bot` service
2. Click **Environment**
3. Add new variable:
   - **Key**: `REDIS_URL`
   - **Value**: Paste the Redis URL from previous step
4. Click **Save Changes**

**Set Environment Variables**

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

**Add config.json as Secret File**

⚠️ **Important:** Since `config.json` is not committed to your repository (it contains sensitive channel IDs), you need to add it as a secret file in Render:

1. In your Render Dashboard, go to your Web Service
2. Click the **Environment** tab
3. Scroll down to **Secret Files** section
4. Click **Add Secret File**
5. Set the following:
   - **Key**: `config.json`
   - **Value**: Copy and paste the contents of your local `config.json` file
6. Click **Save Changes**

Render will automatically place this file in your application's working directory during deployment. The app's code already looks for `config.json` in the root directory, so this secret file will be available to the application.

**Keep Service Awake** (Prevent Free Tier Sleep)

The free tier on Render.com sleeps after 15 minutes of inactivity. To keep it running:

- Option 1: Use UptimeRobot (Recommended)

1. Go to [uptimerobot.com](https://uptimerobot.com) and sign up
2. Click **Add Monitor**
3. Configure:
   - **Monitor Type**: HTTP (HTTPS)
   - **Friendly Name**: `Discord GitHub Bot`
   - **URL**: `https://your-render-url/health`
   - **Monitoring Interval**: 5 minutes
4. Click **Create Monitor**

This will ping your bot every 5 minutes to keep it awake.

- Option 2: Upgrade to Paid

Purchase a paid plan on Render for always-on service.

### Step 5: Configuration File

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

Example:

```json
{
  "discord": {
    "channels": {
      "default": "1234567890",  // Fallback channel
      "repositories": {
        "Jany-M/repo1": "1111111111"  // Method 2: Channel mapping
      }
    }
  },
  "repositories": [
    {
      "name": "Jany-M/repo1",
      "events": ["push", "pull_request"],
      "branches": ["main"],
      "channel": "2222222222"  // Method 1: Override (takes precedence!)
    },
    {
      "name": "Jany-M/repo2",
      "events": ["push"],
      "branches": ["main"]
      // No channel field - will use default or repositories mapping
    }
  ]
}
```
Whenever you update `config.json` , you will need to redeploy the app, locally or on e.g. Render (and after you push it to Github).

### Step 6: Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and give it a name (e.g., "GitHub Bot")
3. Go to the **Bot** section and click **Add Bot**
4. Under **TOKEN**, click **Reset Token** and copy it
5. Add this to your `.env` file as `DISCORD_BOT_TOKEN`
6. Enable these **Privileged Gateway Intents**:
   - Server Members Intent
7. Go to **OAuth2** → **URL Generator**
8. Select scopes: `bot`
9. Select permissions: `Send Messages`, `Embed Links`
10. Copy the generated URL and open it in your browser to invite the bot to your server

**To get your Discord Channel ID:**
1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click the channel and select **Copy Server ID** (or **Copy Channel ID** for text channels)

### Step 7: GitHub OAuth App Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the form:
   - **Application name**: `Discord GitHub Bot`
   - **Homepage URL**: 
     - For local: `http://localhost:3000`
     - For ngrok: `https://your-ngrok-url.ngrok.io` (for local dev / tests)
     - For Render.com: `https://your-app.onrender.com` (for production / cloud deployment)
   - **Authorization callback URL**: 
     - For local: `http://localhost:3000/auth/github/callback`
     - For ngrok: `https://your-ngrok-url.ngrok.io/auth/github/callback` (for local dev / tests)
     - For Render.com: `https://your-app.onrender.com/auth/github/callback` (for production / cloud deployment)
   - **Description**: (Optional)
4. Click **Register application**
5. Copy the **Client ID** and generate a **Client Secret**
6. Add both to your `.env` file as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

### Step 8: GitHub Webhooks

For each repository you want to monitor:

1. Go to your repository on GitHub, the one you want to track.
2. Click **Settings** (top menu)
3. In the left sidebar, click **Webhooks**
4. Click **Add webhook**
5. Fill in the form:
   - **Payload URL**: `https://your-url/webhook/github`
     - Local: `https://your-ngrok-url.ngrok.io/webhook/github` (for local dev / tests)
     - Render.com: `https://your-app.onrender.com/webhook/github` (for production / cloud deployment)
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

### Step 9: Complete OAuth Setup

1. Make sure your `.env` and your `config.json` are now complete with the correct urls.
2. Redeploy the app.
3. Visit `https://your-url/setup`
4. Click **Authorize with GitHub**
5. Complete the authorization flow
6. You should see "Setup Complete!" message

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

## Other Cloud Hosting services

1. **Railway** - Best free option, generous monthly credit
2. **Render + UptimeRobot** - Free forever with uptime monitoring
3. **Fly.io** - Free always-on option (more complex setup)
