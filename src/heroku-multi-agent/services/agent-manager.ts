/**
 * Agent Manager Service
 *
 * Handles agent lifecycle management, command dispatch, and worker coordination.
 * Uses Redis for pub/sub communication in multi-worker deployments.
 */

import { createClient, type RedisClientType } from 'redis';
import {
  findAgentById,
  updateAgentStatus,
  getTelegramToken,
  getClaudeApiKey,
  incrementMessageCount,
  incrementErrorCount,
  listRunningAgents,
  findOrphanedAgents,
  type Agent,
} from '../db/repositories/agent-repository.js';
import { findCustomerById } from '../db/repositories/customer-repository.js';

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Channel names
const AGENT_COMMANDS_CHANNEL = 'openclaw:agent:commands';
const AGENT_EVENTS_CHANNEL = 'openclaw:agent:events';
const AGENT_HEARTBEAT_PREFIX = 'openclaw:agent:heartbeat:';

// Command types
export type AgentCommand = 'start' | 'stop' | 'restart' | 'reload_config';

export interface AgentCommandMessage {
  agentId: string;
  command: AgentCommand;
  timestamp: number;
  workerId?: string;
}

export interface AgentEventMessage {
  agentId: string;
  event: string;
  data?: Record<string, unknown>;
  timestamp: number;
  workerId: string;
}

// Singleton Redis clients
let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;

// Worker ID for this process
const WORKER_ID = `worker-${process.env.DYNO || process.pid}-${Date.now()}`;

// Event handlers
const commandHandlers: Array<(msg: AgentCommandMessage) => Promise<void>> = [];
const eventHandlers: Array<(msg: AgentEventMessage) => void> = [];

/**
 * Initialize Redis connections
 */
export async function initializeRedis(): Promise<void> {
  if (pubClient) return;

  pubClient = createClient({ url: REDIS_URL });
  subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('[Redis] Pub client error:', err));
  subClient.on('error', (err) => console.error('[Redis] Sub client error:', err));

  await Promise.all([pubClient.connect(), subClient.connect()]);

  console.log('[AgentManager] Redis connected');
}

/**
 * Close Redis connections
 */
export async function closeRedis(): Promise<void> {
  await Promise.all([
    pubClient?.quit(),
    subClient?.quit(),
  ]);
  pubClient = null;
  subClient = null;
}

/**
 * Get the pub client
 */
function getPubClient(): RedisClientType {
  if (!pubClient) {
    throw new Error('Redis not initialized. Call initializeRedis() first.');
  }
  return pubClient;
}

/**
 * Publish an agent command
 */
export async function publishAgentCommand(
  agentId: string,
  command: AgentCommand
): Promise<void> {
  const message: AgentCommandMessage = {
    agentId,
    command,
    timestamp: Date.now(),
  };

  await getPubClient().publish(AGENT_COMMANDS_CHANNEL, JSON.stringify(message));
  console.log(`[AgentManager] Published command: ${command} for agent ${agentId}`);
}

/**
 * Publish an agent event
 */
export async function publishAgentEvent(
  agentId: string,
  event: string,
  data?: Record<string, unknown>
): Promise<void> {
  const message: AgentEventMessage = {
    agentId,
    event,
    data,
    timestamp: Date.now(),
    workerId: WORKER_ID,
  };

  await getPubClient().publish(AGENT_EVENTS_CHANNEL, JSON.stringify(message));
}

/**
 * Subscribe to agent commands (for workers)
 */
export async function subscribeToCommands(
  handler: (msg: AgentCommandMessage) => Promise<void>
): Promise<void> {
  if (!subClient) {
    await initializeRedis();
  }

  commandHandlers.push(handler);

  if (commandHandlers.length === 1) {
    await subClient!.subscribe(AGENT_COMMANDS_CHANNEL, (message) => {
      try {
        const parsed = JSON.parse(message) as AgentCommandMessage;
        for (const h of commandHandlers) {
          h(parsed).catch((err) => console.error('[AgentManager] Command handler error:', err));
        }
      } catch (error) {
        console.error('[AgentManager] Failed to parse command:', error);
      }
    });
  }
}

/**
 * Subscribe to agent events (for monitoring)
 */
export async function subscribeToEvents(
  handler: (msg: AgentEventMessage) => void
): Promise<void> {
  if (!subClient) {
    await initializeRedis();
  }

  eventHandlers.push(handler);

  if (eventHandlers.length === 1) {
    await subClient!.subscribe(AGENT_EVENTS_CHANNEL, (message) => {
      try {
        const parsed = JSON.parse(message) as AgentEventMessage;
        for (const h of eventHandlers) {
          h(parsed);
        }
      } catch (error) {
        console.error('[AgentManager] Failed to parse event:', error);
      }
    });
  }
}

/**
 * Update agent heartbeat
 */
export async function updateHeartbeat(agentId: string): Promise<void> {
  await getPubClient().setEx(
    `${AGENT_HEARTBEAT_PREFIX}${agentId}`,
    60, // 60 second TTL
    JSON.stringify({
      workerId: WORKER_ID,
      timestamp: Date.now(),
    })
  );
}

/**
 * Check agent heartbeat
 */
export async function checkHeartbeat(agentId: string): Promise<{
  alive: boolean;
  workerId?: string;
  lastSeen?: number;
}> {
  const data = await getPubClient().get(`${AGENT_HEARTBEAT_PREFIX}${agentId}`);

  if (!data) {
    return { alive: false };
  }

  const parsed = JSON.parse(data);
  return {
    alive: true,
    workerId: parsed.workerId,
    lastSeen: parsed.timestamp,
  };
}

/**
 * Get full agent configuration for worker
 */
export async function getAgentConfig(agentId: string): Promise<{
  agent: Agent;
  telegramToken: string;
  claudeApiKey: string;
  customerPlan: string;
} | null> {
  const agent = await findAgentById(agentId);
  if (!agent) return null;

  const customer = await findCustomerById(agent.customerId);
  if (!customer) return null;

  const [telegramToken, claudeApiKey] = await Promise.all([
    getTelegramToken(agentId, agent.customerId),
    getClaudeApiKey(agentId, agent.customerId),
  ]);

  if (!telegramToken || !claudeApiKey) {
    return null;
  }

  return {
    agent,
    telegramToken,
    claudeApiKey,
    customerPlan: customer.plan,
  };
}

/**
 * Record message processed
 */
export async function recordMessage(agentId: string): Promise<void> {
  await incrementMessageCount(agentId);
  await publishAgentEvent(agentId, 'message.processed');
}

/**
 * Record agent error
 */
export async function recordError(agentId: string, error: string): Promise<void> {
  await incrementErrorCount(agentId);
  await publishAgentEvent(agentId, 'agent.error', { error });
}

/**
 * Handle orphaned agents (running but no heartbeat)
 */
export async function handleOrphanedAgents(): Promise<number> {
  const heartbeatThreshold = new Date(Date.now() - 90 * 1000); // 90 seconds ago
  const orphaned = await findOrphanedAgents(heartbeatThreshold);

  let count = 0;
  for (const agent of orphaned) {
    const heartbeat = await checkHeartbeat(agent.id);
    if (!heartbeat.alive) {
      console.log(`[AgentManager] Marking orphaned agent as stopped: ${agent.id}`);
      await updateAgentStatus(agent.id, 'error');
      await publishAgentEvent(agent.id, 'agent.orphaned', {
        lastWorkerId: agent.workerId,
      });
      count++;
    }
  }

  return count;
}

/**
 * Get all running agents assigned to a worker
 */
export async function getWorkerAgents(workerId: string): Promise<Agent[]> {
  const running = await listRunningAgents();
  return running.filter((a) => a.workerId === workerId);
}

/**
 * Get worker ID for this process
 */
export function getWorkerId(): string {
  return WORKER_ID;
}

/**
 * Acquire lock for agent (prevents multiple workers from processing same agent)
 */
export async function acquireAgentLock(
  agentId: string,
  ttlSeconds: number = 30
): Promise<boolean> {
  const lockKey = `openclaw:agent:lock:${agentId}`;
  const result = await getPubClient().set(lockKey, WORKER_ID, {
    NX: true,
    EX: ttlSeconds,
  });
  return result === 'OK';
}

/**
 * Release agent lock
 */
export async function releaseAgentLock(agentId: string): Promise<void> {
  const lockKey = `openclaw:agent:lock:${agentId}`;
  const currentHolder = await getPubClient().get(lockKey);

  // Only release if we hold the lock
  if (currentHolder === WORKER_ID) {
    await getPubClient().del(lockKey);
  }
}

/**
 * Extend agent lock
 */
export async function extendAgentLock(
  agentId: string,
  ttlSeconds: number = 30
): Promise<boolean> {
  const lockKey = `openclaw:agent:lock:${agentId}`;
  const currentHolder = await getPubClient().get(lockKey);

  if (currentHolder === WORKER_ID) {
    await getPubClient().expire(lockKey, ttlSeconds);
    return true;
  }

  return false;
}
