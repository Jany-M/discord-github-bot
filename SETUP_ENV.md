# Environment Variables Setup

Since `.env` files are gitignored, create your `.env` file manually by copying this template:

## Create .env file

Create a file named `.env` in the root directory with the following content:

```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret

# GitHub Webhook Secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Encryption Key (generate a random 32-byte hex string)
# You can generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_32_byte_hex_encryption_key_here

# Server Configuration
PORT=3000
BASE_URL=http://localhost:3000

# Session Secret (for OAuth flow)
SESSION_SECRET=your_session_secret_here
```

## Generate Secrets

Run these commands to generate secure random secrets:

```bash
# Generate encryption key (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate webhook secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Get Your Tokens

1. **Discord Bot Token**: See [README.md](README.md#discord-bot-setup)
2. **GitHub OAuth App**: See [README.md](README.md#github-oauth-app-setup)
3. **BASE_URL**: 
   - Local: `http://localhost:3000`
   - Deployed: Your deployment URL (e.g., `https://your-app.railway.app`)

## Important Notes

- Never commit your `.env` file to git (it's already in `.gitignore`)
- Keep your secrets secure
- Don't share your tokens publicly
- If you change `ENCRYPTION_KEY` after storing a token, you'll need to re-authenticate

