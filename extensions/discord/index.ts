import type { MoltbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { discordPlugin } from "./src/channel.js";
import { setDiscordRuntime } from "./src/runtime.js";
import { 
  initializeVoiceIntegration, 
  cleanupVoiceIntegration,
  handleDiscordMessageForVoice,
  getVoiceSessionManager,
} from "./src/voice-integration.js";
import { getUserVoiceChannel } from "./src/voice-client.js";
import { 
  registerVoiceProvider, 
  clearVoiceProvider,
} from "../../src/discord/voice-registry.js";

const plugin = {
  id: "discord",
  name: "Discord",
  description: "Discord channel plugin with voice support",
  configSchema: emptyPluginConfigSchema(),
  register(api: MoltbotPluginApi) {
    api.logger.info("[discord-plugin] Register called");
    setDiscordRuntime(api.runtime);
    api.registerChannel({ plugin: discordPlugin });

    // Initialize voice integration (fire-and-forget, plugin system doesn't support async register)
    const config = api.config;
    const discordConfig = config.channels?.discord;
    api.logger.info(`[discord-plugin] Voice enabled check: ${discordConfig?.voice?.enabled}`);
    
    if (discordConfig?.voice?.enabled) {
      api.logger.info("Initializing Discord voice support...");
      
      // Get Discord token - use resolveDiscordToken from runtime config
      // We need to access the token that's being used by the Discord monitor
      const token = discordConfig?.token || process.env.DISCORD_BOT_TOKEN || "";
      
      if (!token) {
        console.error("Cannot initialize Discord voice: token not found");
        return;
      }
      
      // Get API keys from config
      const groqApiKey = config.models?.providers?.groq?.apiKey;
      const elevenlabsApiKey = config.messages?.tts?.elevenlabs?.apiKey;
      const elevenlabsVoiceId = config.messages?.tts?.elevenlabs?.voiceId;
      const elevenlabsModelId = config.messages?.tts?.elevenlabs?.modelId;

      // Initialize in background (don't await - plugin register must be sync)
      initializeVoiceIntegration({
        token,
        groqApiKey,
        elevenlabsApiKey,
        elevenlabsVoiceId,
        elevenlabsModelId,
      }).then(() => {
        // Register voice provider with core after successful initialization
        api.logger.info("Registering Discord voice provider with core...");
        const voiceSessionManager = getVoiceSessionManager();
        
        registerVoiceProvider({
          async joinChannel(guildId: string, channelId: string, userId: string): Promise<void> {
            // Check if already in a voice channel in this guild
            const existingSession = voiceSessionManager.getSession(guildId);
            if (existingSession && existingSession.isSessionActive()) {
              throw new Error("Already in a voice channel in this server.");
            }
            
            // Verify the channel is a voice channel and get voice config
            const voiceChannel = getUserVoiceChannel(guildId, userId);
            if (!voiceChannel) {
              throw new Error("User is not in a voice channel.");
            }
            
            // Create and join voice session
            const session = await voiceSessionManager.createSession({
              guildId,
              channelId,
              userId,
              idleTimeoutMs: discordConfig?.voice?.idleTimeoutMs || 60_000,
              interruptEnabled: discordConfig?.voice?.interruptEnabled ?? true,
            });
            
            await session.join();
          },
          
          async leaveChannel(guildId: string): Promise<void> {
            const session = voiceSessionManager.getSession(guildId);
            if (!session || !session.isSessionActive()) {
              throw new Error("Not in a voice channel.");
            }
            await voiceSessionManager.destroySession(guildId);
          },
          
          getStatus(guildId: string) {
            const session = voiceSessionManager.getSession(guildId);
            if (!session || !session.isSessionActive()) {
              return { connected: false };
            }
            // Access private config via type assertion (safer than direct access)
            const sessionConfig = (session as any).config;
            return {
              connected: true,
              channelId: sessionConfig?.channelId,
              userId: sessionConfig?.userId,
            };
          },
        });
        
        api.logger.info("Discord voice provider registered successfully");
      }).catch((error) => {
        console.error("Failed to initialize Discord voice integration:", error);
      });
    }
  },
  unregister() {
    // Clear voice provider registry
    clearVoiceProvider();
    // Cleanup voice sessions on unregister
    cleanupVoiceIntegration().catch(console.error);
  },
};

// Export voice utilities for use by Discord runtime
export { 
  handleDiscordMessageForVoice,
  getVoiceSessionManager,
};

export default plugin;
