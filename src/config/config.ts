import fs from 'fs';
import path from 'path';
import { Config, RepositoryConfig } from '../types';
import { logger } from '../utils/logger';

let cachedConfig: Config | null = null;
const CONFIG_PATH = path.join(process.cwd(), 'config.json');
const WEBHOOK_TRACE = process.env.WEBHOOK_TRACE === 'true';

function traceConfig(message: string, metadata?: Record<string, unknown>): void {
  if (WEBHOOK_TRACE) {
    logger.info(message, metadata || {});
  }
}

/**
 * Loads and validates the configuration file
 */
export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `Configuration file not found at ${CONFIG_PATH}. ` +
      `Please create a config.json file based on config.example.json`
    );
  }

  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config: Config = JSON.parse(configData);

    // Validate configuration
    validateConfig(config);

    cachedConfig = config;
    logger.info('Configuration loaded successfully');
    traceConfig('Configuration summary', {
      repositories: config.repositories.map(repo => ({
        name: repo.name,
        events: repo.events,
        branches: repo.branches,
        excludeBranches: repo.excludeBranches || [],
        hasChannelOverride: !!repo.channel,
      })),
      hasRepoChannelMap: !!config.discord.channels.repositories,
    });
    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validates the configuration structure
 */
function validateConfig(config: Config): void {
  if (!config.discord) {
    throw new Error('Configuration must have a "discord" section');
  }

  if (!config.discord.channels) {
    throw new Error('Configuration must have "discord.channels" section');
  }

  if (!config.discord.channels.default) {
    throw new Error('Configuration must have "discord.channels.default" channel ID');
  }

  if (!config.repositories || !Array.isArray(config.repositories)) {
    throw new Error('Configuration must have a "repositories" array');
  }

  config.repositories.forEach((repo: RepositoryConfig, index: number) => {
    if (!repo.name) {
      throw new Error(`Repository at index ${index} must have a "name" field`);
    }

    if (!repo.events || !Array.isArray(repo.events) || repo.events.length === 0) {
      throw new Error(`Repository "${repo.name}" must have at least one event type`);
    }

    if (!repo.branches || !Array.isArray(repo.branches) || repo.branches.length === 0) {
      throw new Error(`Repository "${repo.name}" must have at least one branch filter`);
    }

    // Validate event types
    const validEvents = ['push', 'pull_request', 'issues', 'release'];
    repo.events.forEach(event => {
      if (!validEvents.includes(event)) {
        throw new Error(
          `Repository "${repo.name}" has invalid event type "${event}". ` +
          `Valid events are: ${validEvents.join(', ')}`
        );
      }
    });
  });

  logger.debug('Configuration validation passed');
}

/**
 * Gets the Discord channel ID for a repository
 */
export function getChannelForRepository(repoName: string, config?: Config): string {
  const cfg = config || loadConfig();

  // Check for repository-specific channel override
  const repoConfig = cfg.repositories.find(r => r.name === repoName);
  if (repoConfig?.channel && repoConfig.channel !== 'true' && repoConfig.channel !== 'false') {
    return repoConfig.channel;
  }

  // Check for repository-specific channel in discord.channels.repositories
  if (cfg.discord.channels.repositories?.[repoName]) {
    return cfg.discord.channels.repositories[repoName];
  }

  // Fall back to default channel
  return cfg.discord.channels.default;
}

/**
 * Checks if a repository is configured to listen to a specific event
 */
export function shouldHandleEvent(
  repoName: string,
  eventType: string,
  branch?: string,
  config?: Config
): boolean {
  const cfg = config || loadConfig();
  const repoConfig = cfg.repositories.find(r => r.name === repoName);

  if (!repoConfig) {
    traceConfig('Event routing skipped: repository not configured', {
      repoName,
      eventType,
      branch: branch || null,
      configuredRepositories: cfg.repositories.map(r => r.name),
    });
    return false;
  }

  // Check if event type is configured
  if (!repoConfig.events.includes(eventType as any)) {
    traceConfig('Event routing skipped: event type not enabled for repository', {
      repoName,
      eventType,
      enabledEvents: repoConfig.events,
      branch: branch || null,
    });
    return false;
  }

  // Check branch filter if branch is provided
  if (branch) {
    // Check if branch is excluded
    if (repoConfig.excludeBranches) {
      const isExcluded = repoConfig.excludeBranches.some(b => {
        if (b === '*') return true;
        // Support wildcard patterns like "release/*"
        if (b.includes('*')) {
          const pattern = b.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`);
          return regex.test(branch);
        }
        return b === branch;
      });

      if (isExcluded) {
        traceConfig('Event routing skipped: branch is excluded', {
          repoName,
          eventType,
          branch,
          excludeBranches: repoConfig.excludeBranches,
        });
        return false;
      }
    }

    const branchMatches = repoConfig.branches.some(b => {
      if (b === '*') return true;
      // Support wildcard patterns like "feature/*"
      if (b.includes('*')) {
        const pattern = b.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(branch);
      }
      return b === branch;
    });

    if (!branchMatches) {
      traceConfig('Event routing skipped: branch does not match branch filters', {
        repoName,
        eventType,
        branch,
        branches: repoConfig.branches,
      });
      return false;
    }
  }

  traceConfig('Event routing matched', {
    repoName,
    eventType,
    branch: branch || null,
  });

  return true;
}

/**
 * Reloads the configuration (useful after updates)
 */
export function reloadConfig(): Config {
  cachedConfig = null;
  return loadConfig();
}

