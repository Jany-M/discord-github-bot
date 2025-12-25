import { createClient } from 'redis';
import { logger } from './logger';

type RedisClientType = Awaited<ReturnType<typeof createClient>>;

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis client for token and data storage
 */
export async function initializeRedisClient(): Promise<RedisClientType | null> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn('REDIS_URL not set. Token storage will not persist across deployments.');
    return null;
  }

  try {
    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err: Error) => {
      logger.error('Redis client error:', err);
    });

    await redisClient.connect();
    logger.info('Redis client initialized for token storage');
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis client:', error);
    return null;
  }
}

/**
 * Get the Redis client instance
 */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

