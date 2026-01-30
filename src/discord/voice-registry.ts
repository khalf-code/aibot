/**
 * Voice Registry - Bridge between core Discord actions and extension voice implementation
 *
 * This registry allows the Discord extension to register its voice session manager
 * so that agent tools can access voice functionality without direct coupling.
 */

export interface VoiceRegistry {
  /**
   * Join a voice channel
   * @param guildId - Discord guild (server) ID
   * @param channelId - Voice channel ID
   * @param userId - User ID requesting the join
   * @returns Promise that resolves when joined
   */
  joinChannel(guildId: string, channelId: string, userId: string): Promise<void>;

  /**
   * Leave a voice channel
   * @param guildId - Discord guild (server) ID
   * @returns Promise that resolves when left
   */
  leaveChannel(guildId: string): Promise<void>;

  /**
   * Get voice connection status for a guild
   * @param guildId - Discord guild (server) ID
   * @returns Status object with connection info
   */
  getStatus(guildId: string): {
    connected: boolean;
    channelId?: string;
    userId?: string;
  };
}

let registry: VoiceRegistry | null = null;

/**
 * Register a voice provider (called by Discord extension during initialization)
 */
export function registerVoiceProvider(provider: VoiceRegistry): void {
  registry = provider;
}

/**
 * Get the registered voice provider (used by agent tools)
 * @returns The voice registry or null if not initialized
 */
export function getVoiceRegistry(): VoiceRegistry | null {
  return registry;
}

/**
 * Clear the voice provider (used during cleanup/shutdown)
 */
export function clearVoiceProvider(): void {
  registry = null;
}
