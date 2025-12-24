import { createOAuthAppAuth } from '@octokit/auth-oauth-app';
import { Octokit } from '@octokit/rest';
import { encryptToken, decryptToken } from '../utils/encryption';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.join(process.cwd(), '.github_token');

let cachedToken: string | null = null;

/**
 * Gets the GitHub OAuth app authentication instance
 */
export function getOAuthApp() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set in environment variables');
  }

  return createOAuthAppAuth({
    clientId,
    clientSecret,
  });
}

/**
 * Generates the GitHub OAuth authorization URL
 */
export function getAuthorizationUrl(state: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  if (!clientId) {
    throw new Error('GITHUB_CLIENT_ID must be set in environment variables');
  }

  const scopes = ['repo', 'read:org', 'admin:repo_hook'];
  const scopeString = scopes.join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl}/auth/github/callback`,
    scope: scopeString,
    state: state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchanges an authorization code for an access token
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const auth = getOAuthApp();
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  try {
    const { token } = await auth({
      type: 'oauth-user',
      code,
      state: '', // State validation should be done before calling this
    });

    // Validate the token by making an API call
    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    
    logger.info(`GitHub token validated for user: ${user.login}`);

    return token;
  } catch (error) {
    logger.error('Failed to exchange code for token:', error);
    throw new Error(`Failed to exchange authorization code: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Stores an encrypted GitHub token
 */
export function storeToken(token: string): void {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY must be set in environment variables');
  }

  try {
    const encrypted = encryptToken(token, encryptionKey);
    fs.writeFileSync(TOKEN_FILE, encrypted, { mode: 0o600 }); // Read/write for owner only
    cachedToken = token;
    logger.info('GitHub token stored successfully');
  } catch (error) {
    logger.error('Failed to store token:', error);
    throw error;
  }
}

/**
 * Retrieves and decrypts the stored GitHub token
 */
export function getStoredToken(): string | null {
  if (cachedToken) {
    return cachedToken;
  }

  if (!fs.existsSync(TOKEN_FILE)) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY must be set in environment variables');
  }

  try {
    const encrypted = fs.readFileSync(TOKEN_FILE, 'utf8');
    const decrypted = decryptToken(encrypted, encryptionKey);
    cachedToken = decrypted;
    return decrypted;
  } catch (error) {
    logger.error('Failed to retrieve stored token:', error);
    return null;
  }
}

/**
 * Checks if a token is stored
 */
export function hasStoredToken(): boolean {
  return fs.existsSync(TOKEN_FILE) && getStoredToken() !== null;
}

/**
 * Validates a GitHub token by making an API call
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: token });
    await octokit.rest.users.getAuthenticated();
    return true;
  } catch (error) {
    logger.warn('Token validation failed:', error);
    return false;
  }
}

/**
 * Gets an Octokit instance authenticated with the stored token
 */
export function getAuthenticatedOctokit(): Octokit {
  const token = getStoredToken();

  if (!token) {
    throw new Error('No GitHub token stored. Please complete the OAuth setup.');
  }

  return new Octokit({ auth: token });
}

