import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { logger } from '../utils/logger';

let discordClient: Client | null = null;

/**
 * Initializes and connects the Discord bot
 */
export async function initializeDiscordBot(token: string): Promise<Client> {
  if (discordClient) {
    return discordClient;
  }

  logger.info('Initializing Discord bot...');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  client.once('ready', () => {
    logger.info(`Discord bot logged in as ${client.user?.tag}`);
    logger.info(`Bot is in ${client.guilds.cache.size} server(s)`);
  });

  client.on('error', (error) => {
    logger.error('Discord client error:', error);
  });

  client.on('warn', (warning) => {
    logger.warn('Discord client warning:', warning);
  });

  try {
    await client.login(token);
    discordClient = client;
    logger.info('Discord bot connected successfully');
    return client;
  } catch (error) {
    logger.error('Failed to login to Discord:', error);
    throw new Error(`Failed to connect to Discord: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets the Discord client instance
 */
export function getDiscordClient(): Client | null {
  return discordClient;
}

/**
 * Sends a message to a Discord channel
 */
export async function sendToDiscord(
  channelId: string,
  content: string | { embeds?: any[]; content?: string }
): Promise<void> {
  const client = getDiscordClient();
  
  if (!client) {
    throw new Error('Discord client is not initialized');
  }

  try {
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    if (!channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not a text channel`);
    }

    const textChannel = channel as TextChannel;
    
    if (typeof content === 'string') {
      await textChannel.send(content);
    } else {
      await textChannel.send(content);
    }

    logger.debug(`Message sent to Discord channel ${channelId}`);
  } catch (error) {
    logger.error(`Failed to send message to Discord channel ${channelId}:`, error);
    throw error;
  }
}

/**
 * Disconnects the Discord bot
 */
export async function disconnectDiscordBot(): Promise<void> {
  if (discordClient) {
    logger.info('Disconnecting Discord bot...');
    await discordClient.destroy();
    discordClient = null;
    logger.info('Discord bot disconnected');
  }
}

