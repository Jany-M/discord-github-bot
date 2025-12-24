# Deployment Guide

This guide covers deploying the Discord GitHub Bot to various free hosting services.

## Prerequisites

Before deploying, ensure you have:

1. ✅ Completed local setup and testing
2. ✅ Created a GitHub OAuth App with your deployment URL
3. ✅ Created a Discord bot and have the token
4. ✅ Generated all required secrets (encryption key, webhook secret, etc.)

## General Deployment Steps

All platforms follow a similar pattern:

1. Push your code to GitHub
2. Connect your repository to the hosting service
3. Set environment variables
4. Deploy
5. Update GitHub OAuth App callback URL
6. Complete OAuth setup via `/setup` endpoint
7. Configure GitHub webhooks

---

## Railway

**Recommended for: Easy deployment with good free tier**

### Steps

1. **Sign up** at [railway.app](https://railway.app) (GitHub login)

2. **Create a new project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure the service**
   - Railway will auto-detect Node.js
   - Set the start command: `npm start`
   - Set the build command: `npm install && npm run build`

4. **Set environment variables**
   - Go to **Variables** tab
   - Add all variables from `.env.example`:
     ```
     DISCORD_BOT_TOKEN=...
     GITHUB_CLIENT_ID=...
     GITHUB_CLIENT_SECRET=...
     GITHUB_WEBHOOK_SECRET=...
     ENCRYPTION_KEY=...
     BASE_URL=https://your-app.railway.app
     SESSION_SECRET=...
     PORT=3000
     ```

5. **Get your public URL**
   - Railway provides a URL like `https://your-app.up.railway.app`
   - Update `BASE_URL` environment variable with this URL
   - Update your GitHub OAuth App callback URL to: `https://your-app.up.railway.app/auth/github/callback`

6. **Deploy**
   - Railway will automatically deploy on push
   - Check logs to ensure it started successfully

7. **Complete setup**
   - Visit `https://your-app.up.railway.app/setup`
   - Complete the OAuth flow

### Railway Free Tier

- $5 credit per month
- Usually enough for a small bot running 24/7
- Automatic HTTPS
- Easy environment variable management

---

## Render

**Recommended for: Simple deployment, may sleep on free tier**

### Steps

1. **Sign up** at [render.com](https://render.com) (GitHub login)

2. **Create a new Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

3. **Configure the service**
   - **Name**: `discord-github-bot` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Set environment variables**
   - Scroll to **Environment Variables**
   - Add all variables from `.env.example`

5. **Get your public URL**
   - Render provides a URL like `https://your-app.onrender.com`
   - Update `BASE_URL` environment variable
   - Update GitHub OAuth App callback URL

6. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy
   - Check logs for any errors

7. **Keep service awake (optional)**
   - Free tier sleeps after 15 minutes of inactivity
   - Use a service like [UptimeRobot](https://uptimerobot.com) to ping your health endpoint every 5 minutes
   - Set up monitoring for: `https://your-app.onrender.com/health`

### Render Free Tier

- 750 hours/month (enough for 24/7)
- Sleeps after 15 min inactivity
- Automatic HTTPS
- Can use uptime monitoring to prevent sleep

---

## Fly.io

**Recommended for: Always-on free tier, more control**

### Steps

1. **Install Fly CLI**
   ```bash
   # Windows (PowerShell)
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   
   # Or use WSL
   curl -L https://fly.io/install.sh | sh
   ```

2. **Sign up and login**
   ```bash
   fly auth signup
   # or
   fly auth login
   ```

3. **Create a Fly app**
   ```bash
   fly launch
   ```
   - Follow prompts
   - Don't deploy yet (we'll set secrets first)

4. **Set secrets (environment variables)**
   ```bash
   fly secrets set DISCORD_BOT_TOKEN=your_token
   fly secrets set GITHUB_CLIENT_ID=your_id
   fly secrets set GITHUB_CLIENT_SECRET=your_secret
   fly secrets set GITHUB_WEBHOOK_SECRET=your_secret
   fly secrets set ENCRYPTION_KEY=your_key
   fly secrets set BASE_URL=https://your-app.fly.dev
   fly secrets set SESSION_SECRET=your_secret
   ```

5. **Get your public URL**
   - Fly provides: `https://your-app.fly.dev`
   - Update `BASE_URL` secret
   - Update GitHub OAuth App callback URL

6. **Deploy**
   ```bash
   fly deploy
   ```

7. **Complete setup**
   - Visit `https://your-app.fly.dev/setup`
   - Complete OAuth flow

### Fly.io Free Tier

- 3 shared-cpu VMs
- Always-on option available
- More complex setup but more control

---

## Replit

**Recommended for: Quick testing, easy to use**

### Steps

1. **Sign up** at [replit.com](https://replit.com)

2. **Create a new Repl**
   - Click "Create Repl"
   - Choose "Node.js" template
   - Import from GitHub (your repository)

3. **Configure**
   - Create `.env` file in Replit
   - Add all environment variables
   - Set `BASE_URL` to your Replit URL (e.g., `https://your-repl.repl.co`)

4. **Update GitHub OAuth App**
   - Set callback URL to: `https://your-repl.repl.co/auth/github/callback`

5. **Run**
   - Click "Run" button
   - Replit will install dependencies and start the bot

6. **Keep alive (optional)**
   - Free tier may sleep
   - Consider upgrading for always-on

---

## Environment Variables Checklist

Make sure you have all these set:

```bash
DISCORD_BOT_TOKEN=your_discord_bot_token
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GITHUB_WEBHOOK_SECRET=random_secret_for_webhook_verification
ENCRYPTION_KEY=32_character_minimum_random_string
BASE_URL=https://your-deployed-url.com
SESSION_SECRET=random_secret_for_sessions
PORT=3000  # Usually auto-set by hosting service
```

**Generate secrets:**
```bash
# Encryption key (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Webhook secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Post-Deployment Checklist

After deploying:

1. ✅ Verify bot is running (check logs)
2. ✅ Visit `/health` endpoint - should return `{"status":"ok"}`
3. ✅ Visit `/setup` - complete OAuth flow
4. ✅ Verify token is stored (check logs for success message)
5. ✅ Update GitHub webhooks to point to your deployment URL
6. ✅ Test with a test commit/PR to verify notifications work
7. ✅ Set up uptime monitoring (for services that sleep)

---

## Updating GitHub OAuth App

After deployment, update your GitHub OAuth App:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Select your OAuth App
3. Update **Authorization callback URL** to: `https://your-deployed-url/auth/github/callback`
4. Save changes

---

## Updating GitHub Webhooks

For each repository:

1. Go to repository → **Settings** → **Webhooks**
2. Edit your webhook
3. Update **Payload URL** to: `https://your-deployed-url/webhook/github`
4. Verify **Secret** matches `GITHUB_WEBHOOK_SECRET`
5. Save changes

---

## Troubleshooting Deployment

### Bot won't start

- Check logs for errors
- Verify all environment variables are set
- Ensure `ENCRYPTION_KEY` is at least 32 characters
- Check that `BASE_URL` is correct

### OAuth callback fails

- Verify `BASE_URL` matches your deployment URL exactly
- Check GitHub OAuth App callback URL matches: `{BASE_URL}/auth/github/callback`
- Ensure HTTPS is used (not HTTP) for production

### Webhooks not received

- Verify webhook URL in GitHub matches: `{BASE_URL}/webhook/github`
- Check `GITHUB_WEBHOOK_SECRET` matches in both places
- Check bot logs for webhook verification errors

### Service keeps sleeping (Render)

- Set up uptime monitoring to ping `/health` every 5 minutes
- Or upgrade to paid tier for always-on

---

## Recommended Setup

For a production bot, we recommend:

1. **Railway** - Best balance of ease and reliability
2. **Render with UptimeRobot** - Free and reliable with monitoring
3. **Fly.io** - If you want more control and always-on free tier

Choose based on your needs and comfort level with each platform!

