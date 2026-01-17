import crypto from 'crypto';
import { sendToDiscord } from '../discord/bot';
import { getChannelForRepository, shouldHandleEvent } from '../config/config';
import {
  formatPushEvent,
  formatPullRequestEvent,
  formatIssueEvent,
  formatReleaseEvent,
} from '../utils/formatters';
import {
  GitHubPushEvent,
  GitHubPullRequestEvent,
  GitHubIssueEvent,
  GitHubReleaseEvent,
} from '../types';
import { logger } from '../utils/logger';

let webhookSecret: string | null = null;

/**
 * Initializes the GitHub webhooks handler
 */
export function initializeWebhooks(secret: string): void {
  webhookSecret = secret;
  logger.info('GitHub webhooks initialized');
}

/**
 * Handles push events
 */
async function handlePushEvent(payload: GitHubPushEvent): Promise<void> {
  try {
    const repoName = payload.repository.full_name;
    const branch = payload.ref.replace('refs/heads/', '');

    logger.debug(`Received push event for ${repoName} on branch ${branch}`);

    if (!shouldHandleEvent(repoName, 'push', branch)) {
      logger.debug(`Skipping push event for ${repoName} on ${branch} (not configured)`);
      return;
    }

    const channelId = getChannelForRepository(repoName);
    const embed = formatPushEvent(payload);

    await sendToDiscord(channelId, { embeds: [embed] });
    logger.info(`Push event notification sent for ${repoName}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error handling push event for ${payload.repository?.full_name || 'unknown'}:`, {
      message: errorMessage,
      error: error
    });
    throw error; // Re-throw so it's caught by the main handler
  }
}

/**
 * Handles pull request events
 */
async function handlePullRequestEvent(payload: GitHubPullRequestEvent): Promise<void> {
  try {
    const repoName = payload.repository.full_name;
    const branch = payload.pull_request.head.ref;
    const action = payload.action;

    logger.debug(`Received pull_request event for ${repoName} (action: ${action})`);

    // Ignore synchronize to avoid duplicate notifications; push events cover new commits
    if (action === 'synchronize') {
      logger.debug('Skipping pull_request synchronize action to prevent duplicate commit notices');
      return;
    }

    // Only handle opened and closed actions
    if (!['opened', 'closed'].includes(action)) {
      logger.debug(`Skipping pull_request event with action: ${action}`);
      return;
    }

    if (!shouldHandleEvent(repoName, 'pull_request', branch)) {
      logger.debug(`Skipping pull_request event for ${repoName} (not configured)`);
      return;
    }

    const channelId = getChannelForRepository(repoName);
    const embed = formatPullRequestEvent(payload);

    await sendToDiscord(channelId, { embeds: [embed] });
    logger.info(`Pull request event notification sent for ${repoName}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error handling pull_request event for ${payload.repository?.full_name || 'unknown'}:`, {
      message: errorMessage,
      error: error
    });
    throw error; // Re-throw so it's caught by the main handler
  }
}

/**
 * Handles issue events
 */
async function handleIssueEvent(payload: GitHubIssueEvent): Promise<void> {
  try {
    const repoName = payload.repository.full_name;
    const action = payload.action;

    logger.debug(`Received issues event for ${repoName} (action: ${action})`);

    // Only handle opened and closed actions
    if (!['opened', 'closed'].includes(action)) {
      logger.debug(`Skipping issues event with action: ${action}`);
      return;
    }

    if (!shouldHandleEvent(repoName, 'issues')) {
      logger.debug(`Skipping issues event for ${repoName} (not configured)`);
      return;
    }

    const channelId = getChannelForRepository(repoName);
    const embed = formatIssueEvent(payload);

    await sendToDiscord(channelId, { embeds: [embed] });
    logger.info(`Issue event notification sent for ${repoName}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error handling issues event for ${payload.repository?.full_name || 'unknown'}:`, {
      message: errorMessage,
      error: error
    });
    throw error; // Re-throw so it's caught by the main handler
  }
}

/**
 * Handles release events
 */
async function handleReleaseEvent(payload: GitHubReleaseEvent): Promise<void> {
  try {
    const repoName = payload.repository.full_name;
    const action = payload.action;

    logger.debug(`Received release event for ${repoName} (action: ${action})`);

    // Only handle published releases
    if (action !== 'published') {
      logger.debug(`Skipping release event with action: ${action}`);
      return;
    }

    if (!shouldHandleEvent(repoName, 'release')) {
      logger.debug(`Skipping release event for ${repoName} (not configured)`);
      return;
    }

    const channelId = getChannelForRepository(repoName);
    const embed = formatReleaseEvent(payload);

    await sendToDiscord(channelId, { embeds: [embed] });
    logger.info(`Release event notification sent for ${repoName}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error handling release event for ${payload.repository?.full_name || 'unknown'}:`, {
      message: errorMessage,
      error: error
    });
    throw error; // Re-throw so it's caught by the main handler
  }
}

/**
 * Verifies the webhook signature
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature) {
    return false;
  }

  // GitHub sends signature as "sha256=hexdigest"
  const sigParts = signature.split('=');
  if (sigParts.length !== 2 || sigParts[0] !== 'sha256') {
    return false;
  }

  const receivedSignature = sigParts[1];
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Verifies and handles a webhook payload
 */
export async function handleWebhook(
  id: string,
  name: string,
  payload: any,
  signature: string,
  rawBody: string
): Promise<void> {
  if (!webhookSecret) {
    throw new Error('Webhooks not initialized');
  }

  // Verify signature using raw body
  if (!verifySignature(rawBody, signature, webhookSecret)) {
    logger.error('Webhook signature verification failed');
    throw new Error('Invalid webhook signature');
  }

  // Route to appropriate handler based on event type
  try {
    switch (name) {
      case 'push':
        await handlePushEvent(payload as GitHubPushEvent);
        break;
      case 'pull_request':
        await handlePullRequestEvent(payload as GitHubPullRequestEvent);
        break;
      case 'issues':
        await handleIssueEvent(payload as GitHubIssueEvent);
        break;
      case 'release':
        await handleReleaseEvent(payload as GitHubReleaseEvent);
        break;
      default:
        logger.debug(`Unhandled webhook event type: ${name}`);
    }
  } catch (error) {
    logger.error(`Error handling webhook event ${name}:`, error);
    throw error;
  }
}

