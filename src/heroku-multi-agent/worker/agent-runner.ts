/**
 * Agent Runner
 *
 * Runs a single agent instance with Telegram integration and Claude AI.
 * This wraps the OpenClaw core functionality for multi-tenant deployment.
 */

import type { Agent } from '../db/repositories/agent-repository.js';

// Telegram bot interface
interface TelegramBot {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
}

export interface RunningAgent {
  agentId: string;
  agent: Agent;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isTelegramRunning: () => boolean;
}

export interface AgentRunnerOptions {
  agentId: string;
  agent: Agent;
  telegramToken: string;
  claudeApiKey: string;
  onMessage?: () => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

/**
 * Agent Runner Class
 *
 * Manages the lifecycle of a single agent including:
 * - Telegram bot connection
 * - Message processing with Claude
 * - Error handling and recovery
 */
export class AgentRunner implements RunningAgent {
  public readonly agentId: string;
  public readonly agent: Agent;

  private telegramToken: string;
  private claudeApiKey: string;
  private onMessage?: () => Promise<void>;
  private onError?: (error: Error) => Promise<void>;

  private telegramBot: TelegramBot | null = null;
  private isRunning = false;
  private messageQueue: Array<{
    chatId: number;
    text: string;
    resolve: (value: void) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessingQueue = false;

  constructor(options: AgentRunnerOptions) {
    this.agentId = options.agentId;
    this.agent = options.agent;
    this.telegramToken = options.telegramToken;
    this.claudeApiKey = options.claudeApiKey;
    this.onMessage = options.onMessage;
    this.onError = options.onError;
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Agent is already running');
    }

    console.log(`[AgentRunner] Starting agent ${this.agentId}`);

    try {
      // Initialize Telegram bot
      await this.initializeTelegram();

      this.isRunning = true;
      console.log(`[AgentRunner] Agent ${this.agentId} started`);
    } catch (error) {
      console.error(`[AgentRunner] Failed to start agent ${this.agentId}:`, error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log(`[AgentRunner] Stopping agent ${this.agentId}`);

    this.isRunning = false;
    await this.cleanup();

    console.log(`[AgentRunner] Agent ${this.agentId} stopped`);
  }

  /**
   * Check if Telegram is running
   */
  isTelegramRunning(): boolean {
    return this.telegramBot?.isRunning() ?? false;
  }

  /**
   * Initialize Telegram bot
   */
  private async initializeTelegram(): Promise<void> {
    // Dynamic import to avoid loading all dependencies at startup
    const { Bot, webhookCallback } = await import('grammy');
    const { apiThrottler } = await import('@grammyjs/transformer-throttler');

    const bot = new Bot(this.telegramToken);

    // Apply throttling
    bot.api.config.use(apiThrottler());

    // Set up message handlers
    bot.on('message:text', async (ctx) => {
      try {
        // Check if message is from allowed user
        if (!this.isUserAllowed(ctx.from?.id?.toString(), ctx.from?.username)) {
          console.log(`[AgentRunner] Message from non-allowed user: ${ctx.from?.id}`);
          return;
        }

        // Check group policy
        if (ctx.chat.type !== 'private' && !this.isGroupAllowed(ctx.chat.id.toString())) {
          return;
        }

        // Process message
        await this.handleMessage(ctx.chat.id, ctx.message.text, ctx);
      } catch (error) {
        console.error(`[AgentRunner] Error handling message:`, error);
        this.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Error handler
    bot.catch((err) => {
      console.error(`[AgentRunner] Telegram bot error:`, err);
      this.onError?.(err.error instanceof Error ? err.error : new Error(String(err.error)));
    });

    // Start bot with polling (webhook requires HTTPS endpoint)
    await bot.start({
      drop_pending_updates: true,
      allowed_updates: ['message', 'callback_query'],
    });

    this.telegramBot = {
      start: async () => { /* Already started */ },
      stop: async () => await bot.stop(),
      isRunning: () => bot.isInited(),
    };

    console.log(`[AgentRunner] Telegram bot started for agent ${this.agentId}`);
  }

  /**
   * Check if a user is allowed to interact with the bot
   */
  private isUserAllowed(userId?: string, username?: string): boolean {
    const allowList = this.agent.telegramAllowFrom;

    // If no allowlist, check DM policy
    if (!allowList || allowList.length === 0) {
      return this.agent.telegramDmPolicy === 'open';
    }

    // Check if user is in allowlist
    if (userId && allowList.includes(userId)) {
      return true;
    }

    if (username && allowList.includes(username)) {
      return true;
    }

    if (username && allowList.includes(`@${username}`)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a group is allowed
   */
  private isGroupAllowed(groupId: string): boolean {
    switch (this.agent.telegramGroupPolicy) {
      case 'open':
        return true;
      case 'disabled':
        return false;
      case 'allowlist':
        return this.agent.telegramAllowFrom?.includes(groupId) ?? false;
      default:
        return false;
    }
  }

  /**
   * Handle an incoming message
   */
  private async handleMessage(
    chatId: number,
    text: string,
    ctx: unknown
  ): Promise<void> {
    // Add to queue for processing
    return new Promise((resolve, reject) => {
      this.messageQueue.push({ chatId, text, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process message queue (one at a time to avoid rate limits)
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0 && this.isRunning) {
      const message = this.messageQueue.shift()!;

      try {
        // Generate response using Claude
        const response = await this.generateResponse(message.text);

        // Send response via Telegram
        await this.sendTelegramMessage(message.chatId, response);

        // Record message
        await this.onMessage?.();

        message.resolve();
      } catch (error) {
        console.error(`[AgentRunner] Error processing message:`, error);
        message.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Generate a response using Claude API
   */
  private async generateResponse(userMessage: string): Promise<string> {
    const systemPrompt = this.agent.systemPrompt || 'You are a helpful AI assistant.';

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.agent.model || 'claude-sonnet-4-20250514',
          max_tokens: this.agent.maxTokens || 4096,
          temperature: this.agent.temperature || 0.7,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: { message?: string } };
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json() as {
        content: Array<{ type: string; text?: string }>;
      };

      // Extract text from response
      const textContent = data.content.find((c) => c.type === 'text');
      return textContent?.text || 'I apologize, but I was unable to generate a response.';
    } catch (error) {
      console.error(`[AgentRunner] Claude API error:`, error);
      throw error;
    }
  }

  /**
   * Send a message via Telegram
   */
  private async sendTelegramMessage(chatId: number, text: string): Promise<void> {
    // Split long messages (Telegram limit is 4096 characters)
    const MAX_LENGTH = 4000;

    if (text.length <= MAX_LENGTH) {
      await this.sendTelegramChunk(chatId, text);
      return;
    }

    // Split into chunks
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_LENGTH) {
        chunks.push(remaining);
        break;
      }

      // Find a good break point
      let breakPoint = remaining.lastIndexOf('\n\n', MAX_LENGTH);
      if (breakPoint === -1 || breakPoint < MAX_LENGTH / 2) {
        breakPoint = remaining.lastIndexOf('\n', MAX_LENGTH);
      }
      if (breakPoint === -1 || breakPoint < MAX_LENGTH / 2) {
        breakPoint = remaining.lastIndexOf(' ', MAX_LENGTH);
      }
      if (breakPoint === -1) {
        breakPoint = MAX_LENGTH;
      }

      chunks.push(remaining.substring(0, breakPoint));
      remaining = remaining.substring(breakPoint).trim();
    }

    // Send chunks with small delay between them
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await this.sendTelegramChunk(chatId, chunks[i]);
    }
  }

  /**
   * Send a single Telegram message chunk
   */
  private async sendTelegramChunk(chatId: number, text: string): Promise<void> {
    const response = await fetch(
      `https://api.telegram.org/bot${this.telegramToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      }
    );

    if (!response.ok) {
      // Retry without Markdown if parsing failed
      if (response.status === 400) {
        const retryResponse = await fetch(
          `https://api.telegram.org/bot${this.telegramToken}/sendMessage`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              text,
            }),
          }
        );

        if (!retryResponse.ok) {
          throw new Error(`Failed to send Telegram message: ${retryResponse.status}`);
        }
        return;
      }

      throw new Error(`Failed to send Telegram message: ${response.status}`);
    }
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.telegramBot) {
        await this.telegramBot.stop();
        this.telegramBot = null;
      }
    } catch (error) {
      console.error(`[AgentRunner] Cleanup error:`, error);
    }
  }
}
