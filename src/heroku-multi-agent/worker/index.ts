/**
 * Agent Worker
 *
 * Worker process that runs AI agents. Handles agent lifecycle,
 * message processing, and Telegram integration.
 */

import {
  initializeRedis,
  closeRedis,
  subscribeToCommands,
  getAgentConfig,
  updateHeartbeat,
  recordMessage,
  recordError,
  publishAgentEvent,
  getWorkerId,
  acquireAgentLock,
  releaseAgentLock,
  extendAgentLock,
  type AgentCommandMessage,
} from '../services/agent-manager.js';
import { initializePool, closePool } from '../db/client.js';
import {
  updateAgentStatus,
  markTelegramWebhookConfigured,
  listRunningAgents,
} from '../db/repositories/agent-repository.js';
import { AgentRunner, type RunningAgent } from './agent-runner.js';

// Worker state
const runningAgents = new Map<string, RunningAgent>();
let isShuttingDown = false;

// Heartbeat interval
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const LOCK_EXTENSION_INTERVAL = 15000; // 15 seconds

/**
 * Start an agent
 */
async function startAgent(agentId: string): Promise<void> {
  if (runningAgents.has(agentId)) {
    console.log(`[Worker] Agent ${agentId} already running`);
    return;
  }

  // Try to acquire lock
  const acquired = await acquireAgentLock(agentId, 60);
  if (!acquired) {
    console.log(`[Worker] Could not acquire lock for agent ${agentId}`);
    return;
  }

  try {
    // Get agent configuration
    const config = await getAgentConfig(agentId);
    if (!config) {
      console.error(`[Worker] Could not get config for agent ${agentId}`);
      await releaseAgentLock(agentId);
      return;
    }

    console.log(`[Worker] Starting agent ${agentId} (${config.agent.name})`);

    // Create and start agent runner
    const runner = new AgentRunner({
      agentId,
      agent: config.agent,
      telegramToken: config.telegramToken,
      claudeApiKey: config.claudeApiKey,
      onMessage: async () => {
        await recordMessage(agentId);
      },
      onError: async (error) => {
        await recordError(agentId, error.message);
      },
    });

    await runner.start();

    runningAgents.set(agentId, runner);

    // Update status
    await updateAgentStatus(agentId, 'running', getWorkerId());
    await publishAgentEvent(agentId, 'agent.started');

    // Start heartbeat
    startHeartbeat(agentId);

    // Mark webhook as configured if Telegram started successfully
    if (runner.isTelegramRunning()) {
      await markTelegramWebhookConfigured(agentId, true);
    }

    console.log(`[Worker] Agent ${agentId} started successfully`);
  } catch (error) {
    console.error(`[Worker] Failed to start agent ${agentId}:`, error);
    await updateAgentStatus(agentId, 'error');
    await releaseAgentLock(agentId);
    throw error;
  }
}

/**
 * Stop an agent
 */
async function stopAgent(agentId: string): Promise<void> {
  const runner = runningAgents.get(agentId);
  if (!runner) {
    console.log(`[Worker] Agent ${agentId} not running on this worker`);
    return;
  }

  console.log(`[Worker] Stopping agent ${agentId}`);

  try {
    await runner.stop();
    runningAgents.delete(agentId);

    await updateAgentStatus(agentId, 'stopped');
    await publishAgentEvent(agentId, 'agent.stopped');
    await releaseAgentLock(agentId);

    console.log(`[Worker] Agent ${agentId} stopped`);
  } catch (error) {
    console.error(`[Worker] Error stopping agent ${agentId}:`, error);
    runningAgents.delete(agentId);
    await updateAgentStatus(agentId, 'error');
    await releaseAgentLock(agentId);
  }
}

/**
 * Restart an agent
 */
async function restartAgent(agentId: string): Promise<void> {
  console.log(`[Worker] Restarting agent ${agentId}`);

  if (runningAgents.has(agentId)) {
    await stopAgent(agentId);
  }

  await startAgent(agentId);
}

/**
 * Start heartbeat for an agent
 */
function startHeartbeat(agentId: string): void {
  const heartbeatInterval = setInterval(async () => {
    if (!runningAgents.has(agentId) || isShuttingDown) {
      clearInterval(heartbeatInterval);
      return;
    }

    try {
      await updateHeartbeat(agentId);
    } catch (error) {
      console.error(`[Worker] Heartbeat failed for ${agentId}:`, error);
    }
  }, HEARTBEAT_INTERVAL);

  // Also extend lock periodically
  const lockInterval = setInterval(async () => {
    if (!runningAgents.has(agentId) || isShuttingDown) {
      clearInterval(lockInterval);
      return;
    }

    try {
      const extended = await extendAgentLock(agentId, 60);
      if (!extended) {
        console.warn(`[Worker] Lost lock for agent ${agentId}, stopping`);
        await stopAgent(agentId);
      }
    } catch (error) {
      console.error(`[Worker] Lock extension failed for ${agentId}:`, error);
    }
  }, LOCK_EXTENSION_INTERVAL);
}

/**
 * Handle incoming commands
 */
async function handleCommand(msg: AgentCommandMessage): Promise<void> {
  const { agentId, command } = msg;

  console.log(`[Worker] Received command: ${command} for agent ${agentId}`);

  try {
    switch (command) {
      case 'start':
        await startAgent(agentId);
        break;
      case 'stop':
        await stopAgent(agentId);
        break;
      case 'restart':
        await restartAgent(agentId);
        break;
      case 'reload_config':
        // Reload by restarting
        if (runningAgents.has(agentId)) {
          await restartAgent(agentId);
        }
        break;
      default:
        console.warn(`[Worker] Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`[Worker] Command failed:`, error);
  }
}

/**
 * Resume running agents on worker startup
 */
async function resumeAgents(): Promise<void> {
  console.log('[Worker] Checking for agents to resume...');

  const running = await listRunningAgents();
  const workerId = getWorkerId();

  for (const agent of running) {
    // Only resume agents that were assigned to this worker or orphaned
    if (!agent.workerId || agent.workerId === workerId) {
      const acquired = await acquireAgentLock(agent.id);
      if (acquired) {
        console.log(`[Worker] Resuming agent ${agent.id}`);
        try {
          await startAgent(agent.id);
        } catch (error) {
          console.error(`[Worker] Failed to resume agent ${agent.id}:`, error);
        }
      }
    }
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[Worker] Shutting down...');

  // Stop all running agents
  const stopPromises = Array.from(runningAgents.keys()).map((agentId) =>
    stopAgent(agentId).catch((err) => console.error(`[Worker] Error stopping ${agentId}:`, err))
  );

  await Promise.all(stopPromises);

  // Close connections
  await Promise.all([
    closePool(),
    closeRedis(),
  ]);

  console.log('[Worker] Shutdown complete');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log(`[Worker] Starting (ID: ${getWorkerId()})`);

  // Initialize database
  console.log('[Worker] Connecting to database...');
  initializePool();

  // Initialize Redis
  console.log('[Worker] Connecting to Redis...');
  await initializeRedis();

  // Subscribe to commands
  console.log('[Worker] Subscribing to commands...');
  await subscribeToCommands(handleCommand);

  // Resume any agents that should be running
  await resumeAgents();

  console.log('[Worker] Ready');

  // Handle shutdown signals
  process.on('SIGTERM', async () => {
    await shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await shutdown();
    process.exit(0);
  });
}

// Start worker
main().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
