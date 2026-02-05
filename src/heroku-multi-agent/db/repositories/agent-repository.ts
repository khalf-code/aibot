/**
 * Agent Repository
 *
 * Data access layer for agent management with restricted configuration.
 */

import { query, queryOne, queryMany, transaction, type PoolClient } from '../client.js';
import {
  encryptForStorage,
  decryptFromStorage,
  type EncryptedCredential,
} from '../../services/encryption.js';

// Types
export interface Agent {
  id: string;
  customerId: string;
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
  lastActiveAt: Date | null;
  messageCount: number;
  errorCount: number;
  workerId: string | null;
  workerAssignedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentCredentials {
  id: string;
  agentId: string;
  hasTelegram: boolean;
  telegramBotUsername: string | null;
  telegramWebhookConfigured: boolean;
  telegramValidatedAt: Date | null;
  hasClaude: boolean;
  claudeValidatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentInput {
  customerId: string;
  name: string;
  slug?: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  telegramAllowFrom?: string[];
  telegramGroupPolicy?: string;
  telegramDmPolicy?: string;
  metadata?: Record<string, unknown>;
}

// Allowed fields for update (restricted configuration)
export interface UpdateAgentInput {
  name?: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  telegramAllowFrom?: string[];
  telegramGroupPolicy?: string;
  telegramDmPolicy?: string;
  metadata?: Record<string, unknown>;
}

// Allowed models
const ALLOWED_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-3-5-20241022',
];

// Row mapper
function mapAgentRow(row: Record<string, unknown>): Agent {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    name: row.name as string,
    slug: row.slug as string,
    status: row.status as Agent['status'],
    systemPrompt: row.system_prompt as string | null,
    model: row.model as string,
    maxTokens: row.max_tokens as number,
    temperature: parseFloat(row.temperature as string),
    telegramAllowFrom: (row.telegram_allow_from as string[]) || [],
    telegramGroupPolicy: row.telegram_group_policy as string,
    telegramDmPolicy: row.telegram_dm_policy as string,
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at as string) : null,
    messageCount: parseInt(row.message_count as string, 10),
    errorCount: row.error_count as number,
    workerId: row.worker_id as string | null,
    workerAssignedAt: row.worker_assigned_at ? new Date(row.worker_assigned_at as string) : null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Generate a URL-safe slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Validate agent configuration
 */
function validateAgentConfig(input: Partial<UpdateAgentInput>): void {
  if (input.model !== undefined && !ALLOWED_MODELS.includes(input.model)) {
    throw new Error(
      `Invalid model. Allowed models: ${ALLOWED_MODELS.join(', ')}`
    );
  }

  if (input.maxTokens !== undefined && (input.maxTokens < 256 || input.maxTokens > 8192)) {
    throw new Error('maxTokens must be between 256 and 8192');
  }

  if (input.temperature !== undefined && (input.temperature < 0 || input.temperature > 1)) {
    throw new Error('temperature must be between 0 and 1');
  }

  const allowedGroupPolicies = ['open', 'disabled', 'allowlist'];
  if (input.telegramGroupPolicy !== undefined && !allowedGroupPolicies.includes(input.telegramGroupPolicy)) {
    throw new Error(`Invalid telegramGroupPolicy. Allowed: ${allowedGroupPolicies.join(', ')}`);
  }

  const allowedDmPolicies = ['pairing', 'allowlist', 'open', 'disabled'];
  if (input.telegramDmPolicy !== undefined && !allowedDmPolicies.includes(input.telegramDmPolicy)) {
    throw new Error(`Invalid telegramDmPolicy. Allowed: ${allowedDmPolicies.join(', ')}`);
  }
}

/**
 * Create a new agent
 */
export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  validateAgentConfig(input);

  const slug = input.slug || generateSlug(input.name);

  const result = await queryOne(
    `INSERT INTO agents (
      customer_id, name, slug, system_prompt, model, max_tokens, temperature,
      telegram_allow_from, telegram_group_policy, telegram_dm_policy, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      input.customerId,
      input.name,
      slug,
      input.systemPrompt || null,
      input.model || 'claude-sonnet-4-20250514',
      input.maxTokens || 4096,
      input.temperature || 0.7,
      input.telegramAllowFrom || [],
      input.telegramGroupPolicy || 'disabled',
      input.telegramDmPolicy || 'allowlist',
      JSON.stringify(input.metadata || {}),
    ]
  );

  if (!result) {
    throw new Error('Failed to create agent');
  }

  return mapAgentRow(result);
}

/**
 * Find an agent by ID
 */
export async function findAgentById(id: string): Promise<Agent | null> {
  const result = await queryOne(`SELECT * FROM agents WHERE id = $1`, [id]);
  return result ? mapAgentRow(result) : null;
}

/**
 * Find an agent by ID with customer ownership check
 */
export async function findAgentByIdForCustomer(
  id: string,
  customerId: string
): Promise<Agent | null> {
  const result = await queryOne(
    `SELECT * FROM agents WHERE id = $1 AND customer_id = $2`,
    [id, customerId]
  );
  return result ? mapAgentRow(result) : null;
}

/**
 * Find an agent by slug for a customer
 */
export async function findAgentBySlug(
  customerId: string,
  slug: string
): Promise<Agent | null> {
  const result = await queryOne(
    `SELECT * FROM agents WHERE customer_id = $1 AND slug = $2`,
    [customerId, slug]
  );
  return result ? mapAgentRow(result) : null;
}

/**
 * List agents for a customer
 */
export async function listAgentsForCustomer(
  customerId: string,
  options?: {
    status?: Agent['status'];
    limit?: number;
    offset?: number;
  }
): Promise<{ agents: Agent[]; total: number }> {
  const conditions: string[] = ['customer_id = $1'];
  const params: unknown[] = [customerId];
  let paramIndex = 2;

  if (options?.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(options.status);
  }

  const whereClause = conditions.join(' AND ');
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const [countResult, agents] = await Promise.all([
    queryOne(`SELECT COUNT(*) as count FROM agents WHERE ${whereClause}`, params),
    queryMany(
      `SELECT * FROM agents WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    ),
  ]);

  return {
    agents: agents.map(mapAgentRow),
    total: parseInt((countResult?.count as string) || '0', 10),
  };
}

/**
 * Update an agent (with restricted configuration)
 */
export async function updateAgent(
  id: string,
  customerId: string,
  input: UpdateAgentInput
): Promise<Agent | null> {
  validateAgentConfig(input);

  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(input.name);
  }

  if (input.systemPrompt !== undefined) {
    updates.push(`system_prompt = $${paramIndex++}`);
    params.push(input.systemPrompt);
  }

  if (input.model !== undefined) {
    updates.push(`model = $${paramIndex++}`);
    params.push(input.model);
  }

  if (input.maxTokens !== undefined) {
    updates.push(`max_tokens = $${paramIndex++}`);
    params.push(input.maxTokens);
  }

  if (input.temperature !== undefined) {
    updates.push(`temperature = $${paramIndex++}`);
    params.push(input.temperature);
  }

  if (input.telegramAllowFrom !== undefined) {
    updates.push(`telegram_allow_from = $${paramIndex++}`);
    params.push(input.telegramAllowFrom);
  }

  if (input.telegramGroupPolicy !== undefined) {
    updates.push(`telegram_group_policy = $${paramIndex++}`);
    params.push(input.telegramGroupPolicy);
  }

  if (input.telegramDmPolicy !== undefined) {
    updates.push(`telegram_dm_policy = $${paramIndex++}`);
    params.push(input.telegramDmPolicy);
  }

  if (input.metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}`);
    params.push(JSON.stringify(input.metadata));
  }

  if (updates.length === 0) {
    return findAgentByIdForCustomer(id, customerId);
  }

  params.push(id, customerId);

  const result = await queryOne(
    `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND customer_id = $${paramIndex} RETURNING *`,
    params
  );

  return result ? mapAgentRow(result) : null;
}

/**
 * Update agent status
 */
export async function updateAgentStatus(
  id: string,
  status: Agent['status'],
  workerId?: string
): Promise<Agent | null> {
  const updates = ['status = $1'];
  const params: unknown[] = [status];
  let paramIndex = 2;

  if (status === 'running' && workerId) {
    updates.push(`worker_id = $${paramIndex++}`, `worker_assigned_at = NOW()`);
    params.push(workerId);
  } else if (status === 'stopped' || status === 'error') {
    updates.push(`worker_id = NULL`, `worker_assigned_at = NULL`);
  }

  params.push(id);

  const result = await queryOne(
    `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  return result ? mapAgentRow(result) : null;
}

/**
 * Increment agent message count
 */
export async function incrementMessageCount(id: string): Promise<void> {
  await query(
    `UPDATE agents SET message_count = message_count + 1, last_active_at = NOW() WHERE id = $1`,
    [id]
  );
}

/**
 * Increment agent error count
 */
export async function incrementErrorCount(id: string): Promise<void> {
  await query(`UPDATE agents SET error_count = error_count + 1 WHERE id = $1`, [id]);
}

/**
 * Delete an agent
 */
export async function deleteAgent(id: string, customerId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM agents WHERE id = $1 AND customer_id = $2`,
    [id, customerId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * List running agents (for worker assignment)
 */
export async function listRunningAgents(): Promise<Agent[]> {
  const result = await queryMany(`SELECT * FROM agents WHERE status = 'running'`);
  return result.map(mapAgentRow);
}

/**
 * Find orphaned agents (running but no worker heartbeat)
 */
export async function findOrphanedAgents(heartbeatThreshold: Date): Promise<Agent[]> {
  const result = await queryMany(
    `SELECT * FROM agents WHERE status = 'running' AND (worker_assigned_at IS NULL OR worker_assigned_at < $1)`,
    [heartbeatThreshold]
  );
  return result.map(mapAgentRow);
}

// ============ Credentials Management ============

/**
 * Set Telegram credentials for an agent
 */
export async function setTelegramCredentials(
  agentId: string,
  customerId: string,
  botToken: string,
  botUsername?: string
): Promise<void> {
  // Encrypt the token
  const encrypted = encryptForStorage(botToken, customerId);

  await query(
    `INSERT INTO agent_credentials (
      agent_id, telegram_bot_token_encrypted, telegram_bot_token_iv, telegram_bot_token_tag,
      telegram_bot_username, encryption_key_version
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (agent_id) DO UPDATE SET
      telegram_bot_token_encrypted = $2,
      telegram_bot_token_iv = $3,
      telegram_bot_token_tag = $4,
      telegram_bot_username = $5,
      encryption_key_version = $6,
      telegram_validated_at = NULL,
      telegram_webhook_configured = FALSE`,
    [
      agentId,
      Buffer.from(encrypted.encryptedHex, 'hex'),
      Buffer.from(encrypted.ivHex, 'hex'),
      Buffer.from(encrypted.tagHex, 'hex'),
      botUsername || null,
      encrypted.keyVersion,
    ]
  );
}

/**
 * Set Claude API credentials for an agent
 */
export async function setClaudeCredentials(
  agentId: string,
  customerId: string,
  apiKey: string
): Promise<void> {
  const encrypted = encryptForStorage(apiKey, customerId);

  await query(
    `INSERT INTO agent_credentials (
      agent_id, claude_api_key_encrypted, claude_api_key_iv, claude_api_key_tag,
      encryption_key_version
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (agent_id) DO UPDATE SET
      claude_api_key_encrypted = $2,
      claude_api_key_iv = $3,
      claude_api_key_tag = $4,
      encryption_key_version = $5,
      claude_validated_at = NULL`,
    [
      agentId,
      Buffer.from(encrypted.encryptedHex, 'hex'),
      Buffer.from(encrypted.ivHex, 'hex'),
      Buffer.from(encrypted.tagHex, 'hex'),
      encrypted.keyVersion,
    ]
  );
}

/**
 * Get decrypted Telegram bot token
 */
export async function getTelegramToken(
  agentId: string,
  customerId: string
): Promise<string | null> {
  const result = await queryOne(
    `SELECT telegram_bot_token_encrypted, telegram_bot_token_iv, telegram_bot_token_tag, encryption_key_version
     FROM agent_credentials WHERE agent_id = $1`,
    [agentId]
  );

  if (!result || !result.telegram_bot_token_encrypted) {
    return null;
  }

  return decryptFromStorage(
    (result.telegram_bot_token_encrypted as Buffer).toString('hex'),
    (result.telegram_bot_token_iv as Buffer).toString('hex'),
    (result.telegram_bot_token_tag as Buffer).toString('hex'),
    customerId,
    result.encryption_key_version as number
  );
}

/**
 * Get decrypted Claude API key
 */
export async function getClaudeApiKey(
  agentId: string,
  customerId: string
): Promise<string | null> {
  const result = await queryOne(
    `SELECT claude_api_key_encrypted, claude_api_key_iv, claude_api_key_tag, encryption_key_version
     FROM agent_credentials WHERE agent_id = $1`,
    [agentId]
  );

  if (!result || !result.claude_api_key_encrypted) {
    return null;
  }

  return decryptFromStorage(
    (result.claude_api_key_encrypted as Buffer).toString('hex'),
    (result.claude_api_key_iv as Buffer).toString('hex'),
    (result.claude_api_key_tag as Buffer).toString('hex'),
    customerId,
    result.encryption_key_version as number
  );
}

/**
 * Get credentials status (without decryption)
 */
export async function getCredentialsStatus(agentId: string): Promise<AgentCredentials | null> {
  const result = await queryOne(
    `SELECT
      id, agent_id,
      telegram_bot_token_encrypted IS NOT NULL as has_telegram,
      telegram_bot_username,
      telegram_webhook_configured,
      telegram_validated_at,
      claude_api_key_encrypted IS NOT NULL as has_claude,
      claude_validated_at,
      created_at, updated_at
     FROM agent_credentials WHERE agent_id = $1`,
    [agentId]
  );

  if (!result) {
    return null;
  }

  return {
    id: result.id as string,
    agentId: result.agent_id as string,
    hasTelegram: result.has_telegram as boolean,
    telegramBotUsername: result.telegram_bot_username as string | null,
    telegramWebhookConfigured: result.telegram_webhook_configured as boolean,
    telegramValidatedAt: result.telegram_validated_at
      ? new Date(result.telegram_validated_at as string)
      : null,
    hasClaude: result.has_claude as boolean,
    claudeValidatedAt: result.claude_validated_at
      ? new Date(result.claude_validated_at as string)
      : null,
    createdAt: new Date(result.created_at as string),
    updatedAt: new Date(result.updated_at as string),
  };
}

/**
 * Mark Telegram credentials as validated
 */
export async function markTelegramValidated(agentId: string): Promise<void> {
  await query(
    `UPDATE agent_credentials SET telegram_validated_at = NOW() WHERE agent_id = $1`,
    [agentId]
  );
}

/**
 * Mark Claude credentials as validated
 */
export async function markClaudeValidated(agentId: string): Promise<void> {
  await query(
    `UPDATE agent_credentials SET claude_validated_at = NOW() WHERE agent_id = $1`,
    [agentId]
  );
}

/**
 * Mark Telegram webhook as configured
 */
export async function markTelegramWebhookConfigured(agentId: string, configured: boolean): Promise<void> {
  await query(
    `UPDATE agent_credentials SET telegram_webhook_configured = $2 WHERE agent_id = $1`,
    [agentId, configured]
  );
}

/**
 * Delete Telegram credentials
 */
export async function deleteTelegramCredentials(agentId: string): Promise<void> {
  await query(
    `UPDATE agent_credentials SET
      telegram_bot_token_encrypted = NULL,
      telegram_bot_token_iv = NULL,
      telegram_bot_token_tag = NULL,
      telegram_bot_username = NULL,
      telegram_webhook_configured = FALSE,
      telegram_validated_at = NULL
     WHERE agent_id = $1`,
    [agentId]
  );
}

/**
 * Delete Claude credentials
 */
export async function deleteClaudeCredentials(agentId: string): Promise<void> {
  await query(
    `UPDATE agent_credentials SET
      claude_api_key_encrypted = NULL,
      claude_api_key_iv = NULL,
      claude_api_key_tag = NULL,
      claude_validated_at = NULL
     WHERE agent_id = $1`,
    [agentId]
  );
}

/**
 * Check if agent has all required credentials
 */
export async function hasRequiredCredentials(agentId: string): Promise<boolean> {
  const status = await getCredentialsStatus(agentId);
  return status !== null && status.hasTelegram && status.hasClaude;
}

/**
 * Get all allowed models
 */
export function getAllowedModels(): string[] {
  return [...ALLOWED_MODELS];
}
