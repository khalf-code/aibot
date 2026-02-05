/**
 * Customer Repository
 *
 * Data access layer for customer management.
 */

import { query, queryOne, queryMany, transaction } from '../client.js';
import { generateApiKey, hashApiKey, generateWebhookSecret } from '../../services/encryption.js';

// Types
export interface Customer {
  id: string;
  name: string;
  email: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  plan: 'free' | 'pro' | 'enterprise';
  maxAgents: number;
  status: 'active' | 'suspended' | 'deleted';
  metadata: Record<string, unknown>;
  webhookUrl: string | null;
  webhookSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  plan?: 'free' | 'pro' | 'enterprise';
  maxAgents?: number;
  metadata?: Record<string, unknown>;
  webhookUrl?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  maxAgents?: number;
  status?: 'active' | 'suspended' | 'deleted';
  metadata?: Record<string, unknown>;
  webhookUrl?: string | null;
}

// Row mapper
function mapRow(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    apiKeyHash: row.api_key_hash as string,
    apiKeyPrefix: row.api_key_prefix as string,
    plan: row.plan as Customer['plan'],
    maxAgents: row.max_agents as number,
    status: row.status as Customer['status'],
    metadata: (row.metadata as Record<string, unknown>) || {},
    webhookUrl: row.webhook_url as string | null,
    webhookSecret: row.webhook_secret as string | null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Create a new customer
 */
export async function createCustomer(
  input: CreateCustomerInput
): Promise<{ customer: Customer; apiKey: string }> {
  const { key, hash, prefix } = generateApiKey();
  const webhookSecret = input.webhookUrl ? generateWebhookSecret() : null;

  const result = await queryOne(
    `INSERT INTO customers (name, email, api_key_hash, api_key_prefix, plan, max_agents, metadata, webhook_url, webhook_secret)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.name,
      input.email,
      hash,
      prefix,
      input.plan || 'free',
      input.maxAgents || 1,
      JSON.stringify(input.metadata || {}),
      input.webhookUrl || null,
      webhookSecret,
    ]
  );

  if (!result) {
    throw new Error('Failed to create customer');
  }

  return {
    customer: mapRow(result),
    apiKey: key, // Return the plain API key only on creation
  };
}

/**
 * Find a customer by ID
 */
export async function findCustomerById(id: string): Promise<Customer | null> {
  const result = await queryOne(`SELECT * FROM customers WHERE id = $1 AND status != 'deleted'`, [
    id,
  ]);

  return result ? mapRow(result) : null;
}

/**
 * Find a customer by email
 */
export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  const result = await queryOne(
    `SELECT * FROM customers WHERE email = $1 AND status != 'deleted'`,
    [email]
  );

  return result ? mapRow(result) : null;
}

/**
 * Find a customer by API key
 */
export async function findCustomerByApiKey(apiKey: string): Promise<Customer | null> {
  const hash = hashApiKey(apiKey);

  const result = await queryOne(
    `SELECT * FROM customers WHERE api_key_hash = $1 AND status = 'active'`,
    [hash]
  );

  return result ? mapRow(result) : null;
}

/**
 * Find a customer by API key prefix (for debugging)
 */
export async function findCustomerByApiKeyPrefix(prefix: string): Promise<Customer | null> {
  const result = await queryOne(`SELECT * FROM customers WHERE api_key_prefix = $1`, [prefix]);

  return result ? mapRow(result) : null;
}

/**
 * List all customers
 */
export async function listCustomers(options?: {
  status?: Customer['status'];
  plan?: Customer['plan'];
  limit?: number;
  offset?: number;
}): Promise<{ customers: Customer[]; total: number }> {
  const conditions: string[] = ["status != 'deleted'"];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options?.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(options.status);
  }

  if (options?.plan) {
    conditions.push(`plan = $${paramIndex++}`);
    params.push(options.plan);
  }

  const whereClause = conditions.join(' AND ');
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const [countResult, customers] = await Promise.all([
    queryOne(`SELECT COUNT(*) as count FROM customers WHERE ${whereClause}`, params),
    queryMany(
      `SELECT * FROM customers WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    ),
  ]);

  return {
    customers: customers.map(mapRow),
    total: parseInt((countResult?.count as string) || '0', 10),
  };
}

/**
 * Update a customer
 */
export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer | null> {
  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(input.name);
  }

  if (input.email !== undefined) {
    updates.push(`email = $${paramIndex++}`);
    params.push(input.email);
  }

  if (input.plan !== undefined) {
    updates.push(`plan = $${paramIndex++}`);
    params.push(input.plan);
  }

  if (input.maxAgents !== undefined) {
    updates.push(`max_agents = $${paramIndex++}`);
    params.push(input.maxAgents);
  }

  if (input.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    params.push(input.status);
  }

  if (input.metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}`);
    params.push(JSON.stringify(input.metadata));
  }

  if (input.webhookUrl !== undefined) {
    updates.push(`webhook_url = $${paramIndex++}`);
    params.push(input.webhookUrl);

    // Generate new webhook secret if URL is set
    if (input.webhookUrl) {
      updates.push(`webhook_secret = $${paramIndex++}`);
      params.push(generateWebhookSecret());
    } else {
      updates.push(`webhook_secret = NULL`);
    }
  }

  if (updates.length === 0) {
    return findCustomerById(id);
  }

  params.push(id);

  const result = await queryOne(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = $${paramIndex} AND status != 'deleted' RETURNING *`,
    params
  );

  return result ? mapRow(result) : null;
}

/**
 * Delete a customer (soft delete)
 */
export async function deleteCustomer(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE customers SET status = 'deleted', email = email || '_deleted_' || id WHERE id = $1`,
    [id]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Rotate a customer's API key
 */
export async function rotateApiKey(id: string): Promise<{ customer: Customer; apiKey: string } | null> {
  const { key, hash, prefix } = generateApiKey();

  const result = await queryOne(
    `UPDATE customers SET api_key_hash = $1, api_key_prefix = $2 WHERE id = $3 AND status = 'active' RETURNING *`,
    [hash, prefix, id]
  );

  if (!result) {
    return null;
  }

  return {
    customer: mapRow(result),
    apiKey: key,
  };
}

/**
 * Get customer agent count
 */
export async function getCustomerAgentCount(customerId: string): Promise<number> {
  const result = await queryOne(
    `SELECT COUNT(*) as count FROM agents WHERE customer_id = $1 AND status != 'deleted'`,
    [customerId]
  );

  return parseInt((result?.count as string) || '0', 10);
}

/**
 * Check if customer can create more agents
 */
export async function canCreateAgent(customerId: string): Promise<boolean> {
  const customer = await findCustomerById(customerId);
  if (!customer) return false;

  const agentCount = await getCustomerAgentCount(customerId);
  return agentCount < customer.maxAgents;
}
