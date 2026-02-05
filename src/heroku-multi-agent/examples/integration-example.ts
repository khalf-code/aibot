/**
 * OpenClaw Multi-Agent Integration Example
 *
 * This comprehensive example demonstrates how to integrate with the
 * OpenClaw Multi-Agent API to provision and manage AI agents for your
 * SaaS customers.
 *
 * Run with: npx ts-node examples/integration-example.ts
 */

// Configuration
const API_BASE_URL = process.env.OPENCLAW_API_URL || 'https://your-app.herokuapp.com';
const ADMIN_API_KEY = process.env.OPENCLAW_ADMIN_KEY || 'your-admin-api-key';

// Types
interface Customer {
  id: string;
  name: string;
  email: string;
  apiKeyPrefix: string;
  plan: 'free' | 'pro' | 'enterprise';
  maxAgents: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Agent {
  id: string;
  name: string;
  slug: string;
  status: 'created' | 'ready' | 'running' | 'stopped' | 'error';
  model: string;
  systemPrompt: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// API Client Class
class OpenClawClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `API error: ${response.status}`);
    }

    return data as T;
  }

  // Customer Management (Admin)
  async createCustomer(params: {
    name: string;
    email: string;
    plan?: 'free' | 'pro' | 'enterprise';
    maxAgents?: number;
    webhookUrl?: string;
  }): Promise<{ customer: Customer; apiKey: string }> {
    return this.request('POST', '/api/v1/admin/customers', params);
  }

  async getCustomer(id: string): Promise<{ customer: Customer }> {
    return this.request('GET', `/api/v1/admin/customers/${id}`);
  }

  async listCustomers(params?: {
    plan?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ customers: Customer[]; total: number }> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request('GET', `/api/v1/admin/customers${query ? `?${query}` : ''}`);
  }

  async updateCustomer(
    id: string,
    params: Partial<{
      name: string;
      plan: string;
      maxAgents: number;
      status: string;
    }>
  ): Promise<{ customer: Customer }> {
    return this.request('PATCH', `/api/v1/admin/customers/${id}`, params);
  }

  async rotateCustomerApiKey(id: string): Promise<{ customer: Customer; apiKey: string }> {
    return this.request('POST', `/api/v1/admin/customers/${id}/rotate-key`);
  }

  // Agent Management (Customer-scoped)
  async createAgent(params: {
    name: string;
    slug?: string;
    systemPrompt?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    telegramAllowFrom?: string[];
    telegramGroupPolicy?: 'open' | 'disabled' | 'allowlist';
    telegramDmPolicy?: 'pairing' | 'allowlist' | 'open' | 'disabled';
  }): Promise<{ agent: Agent }> {
    return this.request('POST', '/api/v1/agents', params);
  }

  async getAgent(id: string): Promise<{ agent: Agent; credentials: unknown }> {
    return this.request('GET', `/api/v1/agents/${id}`);
  }

  async listAgents(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ agents: Agent[]; total: number }> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request('GET', `/api/v1/agents${query ? `?${query}` : ''}`);
  }

  async updateAgent(
    id: string,
    params: Partial<{
      name: string;
      systemPrompt: string;
      model: string;
      maxTokens: number;
      temperature: number;
      telegramAllowFrom: string[];
    }>
  ): Promise<{ agent: Agent }> {
    return this.request('PATCH', `/api/v1/agents/${id}`, params);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/agents/${id}`);
  }

  // Agent Lifecycle
  async startAgent(id: string): Promise<{ agent: Agent; message: string }> {
    return this.request('POST', `/api/v1/agents/${id}/start`);
  }

  async stopAgent(id: string): Promise<{ agent: Agent; message: string }> {
    return this.request('POST', `/api/v1/agents/${id}/stop`);
  }

  async restartAgent(id: string): Promise<{ agent: Agent; message: string }> {
    return this.request('POST', `/api/v1/agents/${id}/restart`);
  }

  async getAgentStatus(id: string): Promise<{
    id: string;
    status: string;
    workerId: string | null;
    lastActiveAt: string | null;
    messageCount: number;
    credentials: unknown;
  }> {
    return this.request('GET', `/api/v1/agents/${id}/status`);
  }

  // Credentials Management
  async setTelegramCredentials(
    agentId: string,
    params: { botToken: string; botUsername?: string }
  ): Promise<{ message: string }> {
    return this.request('PUT', `/api/v1/agents/${agentId}/credentials/telegram`, params);
  }

  async setClaudeCredentials(
    agentId: string,
    params: { apiKey: string }
  ): Promise<{ message: string }> {
    return this.request('PUT', `/api/v1/agents/${agentId}/credentials/claude`, params);
  }

  async validateCredentials(agentId: string): Promise<{
    validation: {
      telegram?: { valid: boolean; error?: string; botInfo?: unknown };
      claude?: { valid: boolean; error?: string };
    };
    allValid: boolean;
  }> {
    return this.request('POST', `/api/v1/agents/${agentId}/credentials/validate`);
  }

  async getCredentialsStatus(agentId: string): Promise<{
    telegram: { configured: boolean; validated: boolean };
    claude: { configured: boolean; validated: boolean };
  }> {
    return this.request('GET', `/api/v1/agents/${agentId}/credentials/status`);
  }
}

// ============================================================
// EXAMPLE: Complete Customer Onboarding Flow
// ============================================================

async function exampleCustomerOnboarding() {
  console.log('='.repeat(60));
  console.log('Example: Complete Customer Onboarding Flow');
  console.log('='.repeat(60));

  // Step 1: Create admin client
  const adminClient = new OpenClawClient(API_BASE_URL, ADMIN_API_KEY);

  // Step 2: Create a new customer
  console.log('\n1. Creating new customer...');
  const { customer, apiKey } = await adminClient.createCustomer({
    name: 'Acme Corp',
    email: 'admin@acme.example.com',
    plan: 'pro',
    maxAgents: 5,
    webhookUrl: 'https://acme.example.com/webhooks/openclaw',
  });

  console.log(`   Customer created: ${customer.id}`);
  console.log(`   API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`   Plan: ${customer.plan} (${customer.maxAgents} agents)`);

  // Step 3: Create customer-scoped client
  const customerClient = new OpenClawClient(API_BASE_URL, apiKey);

  // Step 4: Create an agent
  console.log('\n2. Creating AI agent...');
  const { agent } = await customerClient.createAgent({
    name: 'Acme Support Bot',
    slug: 'support-bot',
    systemPrompt: `You are the official support assistant for Acme Corp.

Your responsibilities:
- Answer product questions
- Help with troubleshooting
- Provide account information
- Escalate complex issues to human support

Always be helpful, professional, and concise.`,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.7,
    telegramDmPolicy: 'open',
    telegramGroupPolicy: 'disabled',
  });

  console.log(`   Agent created: ${agent.id}`);
  console.log(`   Status: ${agent.status}`);

  // Step 5: Configure Telegram credentials
  console.log('\n3. Configuring Telegram bot...');

  // In production, these would come from your customer's input
  const TELEGRAM_BOT_TOKEN = process.env.EXAMPLE_TELEGRAM_TOKEN || '123456:ABC-DEF';
  const TELEGRAM_BOT_USERNAME = process.env.EXAMPLE_TELEGRAM_USERNAME || 'AcmeSupportBot';

  await customerClient.setTelegramCredentials(agent.id, {
    botToken: TELEGRAM_BOT_TOKEN,
    botUsername: TELEGRAM_BOT_USERNAME,
  });
  console.log('   Telegram credentials saved');

  // Step 6: Configure Claude API credentials
  console.log('\n4. Configuring Claude API...');

  const CLAUDE_API_KEY = process.env.EXAMPLE_CLAUDE_KEY || 'sk-ant-api-xxx';

  await customerClient.setClaudeCredentials(agent.id, {
    apiKey: CLAUDE_API_KEY,
  });
  console.log('   Claude API credentials saved');

  // Step 7: Validate credentials
  console.log('\n5. Validating credentials...');
  const validation = await customerClient.validateCredentials(agent.id);
  console.log(`   Telegram: ${validation.validation.telegram?.valid ? '✓ Valid' : '✗ Invalid'}`);
  console.log(`   Claude: ${validation.validation.claude?.valid ? '✓ Valid' : '✗ Invalid'}`);

  // Step 8: Start the agent
  if (validation.allValid) {
    console.log('\n6. Starting agent...');
    const startResult = await customerClient.startAgent(agent.id);
    console.log(`   Status: ${startResult.agent.status}`);
    console.log(`   Message: ${startResult.message}`);
  } else {
    console.log('\n6. Skipping start - credentials not valid');
  }

  // Step 9: Check agent status
  console.log('\n7. Agent status:');
  const status = await customerClient.getAgentStatus(agent.id);
  console.log(`   ID: ${status.id}`);
  console.log(`   Status: ${status.status}`);
  console.log(`   Worker: ${status.workerId || 'Not assigned'}`);
  console.log(`   Messages: ${status.messageCount}`);

  console.log('\n' + '='.repeat(60));
  console.log('Customer onboarding complete!');
  console.log('='.repeat(60));

  return { customer, agent, apiKey };
}

// ============================================================
// EXAMPLE: Multi-Agent Management
// ============================================================

async function exampleMultiAgentManagement(customerApiKey: string) {
  console.log('\n' + '='.repeat(60));
  console.log('Example: Multi-Agent Management');
  console.log('='.repeat(60));

  const client = new OpenClawClient(API_BASE_URL, customerApiKey);

  // Create multiple agents for different purposes
  console.log('\n1. Creating multiple agents...');

  const agents = await Promise.all([
    client.createAgent({
      name: 'Sales Bot',
      slug: 'sales',
      systemPrompt: 'You are a sales assistant. Help customers find products.',
      telegramDmPolicy: 'open',
    }),
    client.createAgent({
      name: 'FAQ Bot',
      slug: 'faq',
      systemPrompt: 'You answer frequently asked questions about our service.',
      telegramDmPolicy: 'open',
    }),
    client.createAgent({
      name: 'VIP Support',
      slug: 'vip',
      systemPrompt: 'You provide premium support for VIP customers.',
      model: 'claude-opus-4-20250514',
      telegramDmPolicy: 'allowlist',
      telegramAllowFrom: ['vip_user_1', 'vip_user_2'],
    }),
  ]);

  console.log(`   Created ${agents.length} agents`);

  // List all agents
  console.log('\n2. Listing all agents...');
  const { agents: allAgents, total } = await client.listAgents();
  console.log(`   Total agents: ${total}`);
  allAgents.forEach((a) => {
    console.log(`   - ${a.name} (${a.slug}): ${a.status}`);
  });

  // Update an agent
  console.log('\n3. Updating Sales Bot...');
  const updatedAgent = await client.updateAgent(agents[0].agent.id, {
    systemPrompt: 'You are an expert sales assistant. Help customers find the perfect product.',
    temperature: 0.8,
  });
  console.log(`   Updated: ${updatedAgent.agent.name}`);

  // Get agent statistics
  console.log('\n4. Agent statistics:');
  for (const { agent } of agents) {
    const status = await client.getAgentStatus(agent.id);
    console.log(`   ${agent.name}: ${status.messageCount} messages`);
  }

  return agents;
}

// ============================================================
// EXAMPLE: Webhook Integration
// ============================================================

function exampleWebhookHandler() {
  console.log('\n' + '='.repeat(60));
  console.log('Example: Webhook Handler (Express)');
  console.log('='.repeat(60));

  const webhookHandlerCode = `
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Webhook secret from OpenClaw dashboard
const WEBHOOK_SECRET = process.env.OPENCLAW_WEBHOOK_SECRET;

// Verify webhook signature
function verifySignature(payload: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Webhook endpoint
app.post('/webhooks/openclaw', (req, res) => {
  const signature = req.headers['x-openclaw-signature'] as string;
  const payload = JSON.stringify(req.body);

  if (!verifySignature(payload, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  switch (event.type) {
    case 'agent.started':
      console.log(\`Agent \${event.agentId} started\`);
      // Update your database, notify admins, etc.
      break;

    case 'agent.stopped':
      console.log(\`Agent \${event.agentId} stopped\`);
      break;

    case 'agent.error':
      console.error(\`Agent \${event.agentId} error: \${event.data.error}\`);
      // Alert your monitoring system
      break;

    case 'message.processed':
      console.log(\`Message processed by agent \${event.agentId}\`);
      // Update usage metrics
      break;

    default:
      console.log(\`Unknown event: \${event.type}\`);
  }

  res.json({ received: true });
});

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});
`;

  console.log('\nExample webhook handler code:');
  console.log(webhookHandlerCode);
}

// ============================================================
// EXAMPLE: Customer Self-Service API
// ============================================================

function exampleCustomerSelfService() {
  console.log('\n' + '='.repeat(60));
  console.log('Example: Customer Self-Service API Integration');
  console.log('='.repeat(60));

  const selfServiceCode = `
// Example: React component for agent management

import { useState, useEffect } from 'react';

interface Agent {
  id: string;
  name: string;
  status: string;
  messageCount: number;
}

export function AgentDashboard({ apiKey }: { apiKey: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    const response = await fetch('/api/v1/agents', {
      headers: { Authorization: \`Bearer \${apiKey}\` },
    });
    const data = await response.json();
    setAgents(data.agents);
    setLoading(false);
  }

  async function toggleAgent(id: string, currentStatus: string) {
    const action = currentStatus === 'running' ? 'stop' : 'start';
    await fetch(\`/api/v1/agents/\${id}/\${action}\`, {
      method: 'POST',
      headers: { Authorization: \`Bearer \${apiKey}\` },
    });
    fetchAgents();
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="agent-dashboard">
      <h2>Your AI Agents</h2>
      <div className="agents-grid">
        {agents.map((agent) => (
          <div key={agent.id} className="agent-card">
            <h3>{agent.name}</h3>
            <span className={\`status \${agent.status}\`}>
              {agent.status}
            </span>
            <p>{agent.messageCount} messages</p>
            <button onClick={() => toggleAgent(agent.id, agent.status)}>
              {agent.status === 'running' ? 'Stop' : 'Start'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
`;

  console.log('\nExample React dashboard component:');
  console.log(selfServiceCode);
}

// ============================================================
// Main Execution
// ============================================================

async function main() {
  try {
    console.log('\n🚀 OpenClaw Multi-Agent Integration Examples\n');

    // Check if we have real credentials
    const hasRealCredentials =
      process.env.OPENCLAW_API_URL && process.env.OPENCLAW_ADMIN_KEY;

    if (hasRealCredentials) {
      // Run actual API calls
      const { apiKey } = await exampleCustomerOnboarding();
      await exampleMultiAgentManagement(apiKey);
    } else {
      console.log('ℹ️  Running in demo mode (no real API calls)');
      console.log('   Set OPENCLAW_API_URL and OPENCLAW_ADMIN_KEY to run real examples\n');
    }

    // Show code examples
    exampleWebhookHandler();
    exampleCustomerSelfService();

    console.log('\n' + '='.repeat(60));
    console.log('Examples complete! See ARCHITECTURE.md for full documentation.');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

main();
