import { createOAuthAppAuth } from '@octokit/auth-oauth-app';
import { Octokit } from '@octokit/rest';
import { encryptToken, decryptToken } from '../utils/encryption';
import { logger } from '../utils/logger';
import { getRedisClient } from '../utils/redis';
import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.join(process.cwd(), '.github_token');
const REDIS_TOKEN_KEY = 'github:token';

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
 * Stores an encrypted GitHub token (in Redis if available, falls back to disk)
 */
export async function storeToken(token: string): Promise<void> {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY must be set in environment variables');
  }

  try {
    const encrypted = encryptToken(token, encryptionKey);
    cachedToken = token;

    // Try to store in Redis first (persistent across deployments)
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.set(REDIS_TOKEN_KEY, encrypted, { EX: 60 * 60 * 24 * 365 }); // 1 year expiry
        logger.info('GitHub token stored in Redis');
      } catch (redisError) {
        logger.warn('Failed to store token in Redis, falling back to disk:', redisError);
        fs.writeFileSync(TOKEN_FILE, encrypted, { mode: 0o600 }); // Read/write for owner only
      }
    } else {
      // Redis not available, store on disk
      fs.writeFileSync(TOKEN_FILE, encrypted, { mode: 0o600 });
    }

    logger.info('GitHub token stored successfully');
  } catch (error) {
    logger.error('Failed to store token:', error);
    throw error;
  }
}

/**
 * Retrieves and decrypts the stored GitHub token (from Redis if available, falls back to disk)
 */
export async function getStoredToken(): Promise<string | null> {
  if (cachedToken) {
    return cachedToken;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY must be set in environment variables');
  }

  try {
    // Try to retrieve from Redis first
    const redis = getRedisClient();
    if (redis) {
      try {
        const encrypted = await redis.get(REDIS_TOKEN_KEY);
        if (encrypted) {
          const decrypted = decryptToken(encrypted, encryptionKey);
          cachedToken = decrypted;
          logger.info('GitHub token retrieved from Redis');
          return decrypted;
        }
      } catch (redisError) {
        logger.warn('Failed to retrieve token from Redis:', redisError);
      }
    }

    // Fall back to disk
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }

    const encrypted = fs.readFileSync(TOKEN_FILE, 'utf8');
    const decrypted = decryptToken(encrypted, encryptionKey);
    cachedToken = decrypted;

    // Try to store in Redis for future access
    if (redis) {
      try {
        await redis.set(REDIS_TOKEN_KEY, encrypted, { EX: 60 * 60 * 24 * 365 });
      } catch (error) {
        logger.warn('Failed to cache token in Redis:', error);
      }
    }

    logger.info('GitHub token retrieved from disk');
    return decrypted;
  } catch (error) {
    logger.error('Failed to retrieve stored token:', error);
    return null;
  }
}

/**
 * Checks if a token is stored (cached in memory or available on disk/Redis)
 */
export function hasStoredToken(): boolean {
  // If we have a cached token, it's definitely stored
  if (cachedToken) {
    return true;
  }

  // Check if token file exists on disk
  if (fs.existsSync(TOKEN_FILE)) {
    return true;
  }

  // Note: We can't check Redis synchronously, but if the token was loaded from Redis
  // on startup, it will be in the cache above
  return false;
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
export async function getAuthenticatedOctokit(): Promise<Octokit> {
  const token = await getStoredToken();

  if (!token) {
    throw new Error('No GitHub token stored. Please complete the OAuth setup.');
  }

  return new Octokit({ auth: token });
}

