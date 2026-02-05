/**
 * OpenClaw Multi-Agent SDK Client
 *
 * A production-ready TypeScript client for the OpenClaw Multi-Agent API.
 * Can be published as a standalone npm package for customer integration.
 */

// Types
export interface CustomerCreateParams {
  name: string;
  email: string;
  plan?: 'free' | 'pro' | 'enterprise';
  maxAgents?: number;
  metadata?: Record<string, unknown>;
  webhookUrl?: string;
}

export interface CustomerUpdateParams {
  name?: string;
  email?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  maxAgents?: number;
  status?: 'active' | 'suspended';
  metadata?: Record<string, unknown>;
  webhookUrl?: string | null;
}

export interface AgentCreateParams {
  name: string;
  slug?: string;
  systemPrompt?: string;
  model?: 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514' | 'claude-haiku-3-5-20241022';
  maxTokens?: number;
  temperature?: number;
  telegramAllowFrom?: string[];
  telegramGroupPolicy?: 'open' | 'disabled' | 'allowlist';
  telegramDmPolicy?: 'pairing' | 'allowlist' | 'open' | 'disabled';
  metadata?: Record<string, unknown>;
}

export interface AgentUpdateParams {
  name?: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  telegramAllowFrom?: string[];
  telegramGroupPolicy?: 'open' | 'disabled' | 'allowlist';
  telegramDmPolicy?: 'pairing' | 'allowlist' | 'open' | 'disabled';
  metadata?: Record<string, unknown>;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  apiKeyPrefix: string;
  plan: 'free' | 'pro' | 'enterprise';
  maxAgents: number;
  status: 'active' | 'suspended' | 'deleted';
  metadata: Record<string, unknown>;
  webhookUrl: string | null;
  hasWebhookSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  slug: string;
  status: 'created' | 'ready' | 'running' | 'stopped' | 'error';
  systemPrompt: string | null;
  model: string;
  maxTokens: number;
  temperature: number;
  telegramAllowFrom: string[];
  telegramGroupPolicy: string;
  telegramDmPolicy: string;
  lastActiveAt: string | null;
  messageCount: number;
  errorCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: string;
  workerId: string | null;
  workerAssignedAt: string | null;
  lastActiveAt: string | null;
  messageCount: number;
  errorCount: number;
  credentials: {
    telegramConfigured: boolean;
    telegramValidated: boolean;
    telegramWebhookConfigured: boolean;
    claudeConfigured: boolean;
    claudeValidated: boolean;
  } | null;
}

export interface CredentialsStatus {
  telegram: {
    configured: boolean;
    botUsername: string | null;
    webhookConfigured: boolean;
    validated: boolean;
    validatedAt: string | null;
  };
  claude: {
    configured: boolean;
    validated: boolean;
    validatedAt: string | null;
  };
}

export interface ValidationResult {
  validation: {
    telegram?: {
      valid: boolean;
      error?: string;
      botInfo?: {
        id: number;
        first_name: string;
        username: string;
      };
    };
    claude?: {
      valid: boolean;
      error?: string;
    };
  };
  allValid: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown[];
}

// SDK Options
export interface OpenClawClientOptions {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  retries?: number;
  onError?: (error: ApiError) => void;
}

/**
 * OpenClaw Multi-Agent SDK Client
 */
export class OpenClawClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private retries: number;
  private onError?: (error: ApiError) => void;

  constructor(options: OpenClawClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? 30000;
    this.retries = options.retries ?? 3;
    this.onError = options.onError;
  }

  // ============ Private Methods ============

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: Record<string, unknown>;
      query?: Record<string, string | number | undefined>;
    }
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    // Add query parameters
    if (options?.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
          const apiError: ApiError = {
            error: data.error || 'Unknown Error',
            message: data.message || `Request failed with status ${response.status}`,
            details: data.details,
          };

          this.onError?.(apiError);

          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw new OpenClawApiError(apiError, response.status);
          }

          throw new Error(apiError.message);
        }

        return data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry if it's an API error
        if (error instanceof OpenClawApiError) {
          throw error;
        }

        // Retry with exponential backoff
        if (attempt < this.retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  // ============ Admin: Customer Management ============

  /**
   * Create a new customer (Admin only)
   */
  async createCustomer(
    params: CustomerCreateParams
  ): Promise<{ customer: Customer; apiKey: string }> {
    return this.request('POST', '/api/v1/admin/customers', { body: params });
  }

  /**
   * Get a customer by ID (Admin only)
   */
  async getCustomer(id: string): Promise<{ customer: Customer }> {
    return this.request('GET', `/api/v1/admin/customers/${id}`);
  }

  /**
   * List all customers (Admin only)
   */
  async listCustomers(params?: {
    status?: 'active' | 'suspended';
    plan?: 'free' | 'pro' | 'enterprise';
    limit?: number;
    offset?: number;
  }): Promise<{ customers: Customer[]; total: number; limit: number; offset: number }> {
    return this.request('GET', '/api/v1/admin/customers', { query: params });
  }

  /**
   * Update a customer (Admin only)
   */
  async updateCustomer(id: string, params: CustomerUpdateParams): Promise<{ customer: Customer }> {
    return this.request('PATCH', `/api/v1/admin/customers/${id}`, { body: params });
  }

  /**
   * Delete a customer (Admin only)
   */
  async deleteCustomer(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/admin/customers/${id}`);
  }

  /**
   * Rotate customer API key (Admin only)
   */
  async rotateCustomerApiKey(id: string): Promise<{ customer: Customer; apiKey: string }> {
    return this.request('POST', `/api/v1/admin/customers/${id}/rotate-key`);
  }

  // ============ Agent Management ============

  /**
   * Create a new agent
   */
  async createAgent(params: AgentCreateParams): Promise<{ agent: Agent }> {
    return this.request('POST', '/api/v1/agents', { body: params });
  }

  /**
   * Get an agent by ID
   */
  async getAgent(id: string): Promise<{ agent: Agent; credentials: CredentialsStatus | null }> {
    return this.request('GET', `/api/v1/agents/${id}`);
  }

  /**
   * List all agents
   */
  async listAgents(params?: {
    status?: 'created' | 'ready' | 'running' | 'stopped' | 'error';
    limit?: number;
    offset?: number;
  }): Promise<{ agents: Agent[]; total: number; limit: number; offset: number }> {
    return this.request('GET', '/api/v1/agents', { query: params });
  }

  /**
   * Update an agent
   */
  async updateAgent(id: string, params: AgentUpdateParams): Promise<{ agent: Agent }> {
    return this.request('PATCH', `/api/v1/agents/${id}`, { body: params });
  }

  /**
   * Delete an agent
   */
  async deleteAgent(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/agents/${id}`);
  }

  // ============ Agent Lifecycle ============

  /**
   * Start an agent
   */
  async startAgent(id: string): Promise<{ agent: Agent; message: string }> {
    return this.request('POST', `/api/v1/agents/${id}/start`);
  }

  /**
   * Stop an agent
   */
  async stopAgent(id: string): Promise<{ agent: Agent; message: string }> {
    return this.request('POST', `/api/v1/agents/${id}/stop`);
  }

  /**
   * Restart an agent
   */
  async restartAgent(id: string): Promise<{ agent: Agent; message: string }> {
    return this.request('POST', `/api/v1/agents/${id}/restart`);
  }

  /**
   * Get agent status
   */
  async getAgentStatus(id: string): Promise<AgentStatus> {
    return this.request('GET', `/api/v1/agents/${id}/status`);
  }

  /**
   * Get agent statistics
   */
  async getAgentStats(id: string): Promise<{
    id: string;
    messageCount: number;
    errorCount: number;
    lastActiveAt: string | null;
    createdAt: string;
    uptime: number;
  }> {
    return this.request('GET', `/api/v1/agents/${id}/stats`);
  }

  // ============ Credentials Management ============

  /**
   * Set Telegram credentials for an agent
   */
  async setTelegramCredentials(
    agentId: string,
    params: { botToken: string; botUsername?: string }
  ): Promise<{ message: string; telegramBotUsername: string | null }> {
    return this.request('PUT', `/api/v1/agents/${agentId}/credentials/telegram`, { body: params });
  }

  /**
   * Set Claude API credentials for an agent
   */
  async setClaudeCredentials(
    agentId: string,
    params: { apiKey: string }
  ): Promise<{ message: string }> {
    return this.request('PUT', `/api/v1/agents/${agentId}/credentials/claude`, { body: params });
  }

  /**
   * Delete Telegram credentials
   */
  async deleteTelegramCredentials(agentId: string): Promise<{ message: string }> {
    return this.request('DELETE', `/api/v1/agents/${agentId}/credentials/telegram`);
  }

  /**
   * Delete Claude credentials
   */
  async deleteClaudeCredentials(agentId: string): Promise<{ message: string }> {
    return this.request('DELETE', `/api/v1/agents/${agentId}/credentials/claude`);
  }

  /**
   * Get credentials status
   */
  async getCredentialsStatus(agentId: string): Promise<CredentialsStatus> {
    return this.request('GET', `/api/v1/agents/${agentId}/credentials/status`);
  }

  /**
   * Validate credentials
   */
  async validateCredentials(agentId: string): Promise<ValidationResult> {
    return this.request('POST', `/api/v1/agents/${agentId}/credentials/validate`);
  }

  // ============ Utility Methods ============

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<{ models: string[] }> {
    return this.request('GET', '/api/v1/agents/config/models');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    checks: Record<string, unknown>;
  }> {
    return this.request('GET', '/health');
  }
}

/**
 * Custom error class for API errors
 */
export class OpenClawApiError extends Error {
  public readonly statusCode: number;
  public readonly apiError: ApiError;

  constructor(apiError: ApiError, statusCode: number) {
    super(apiError.message);
    this.name = 'OpenClawApiError';
    this.statusCode = statusCode;
    this.apiError = apiError;
  }
}

// Default export
export default OpenClawClient;
