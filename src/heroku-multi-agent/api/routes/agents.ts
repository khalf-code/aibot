/**
 * Agent Routes
 *
 * Agent CRUD and lifecycle management endpoints.
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  createAgent,
  findAgentByIdForCustomer,
  findAgentBySlug,
  listAgentsForCustomer,
  updateAgent,
  deleteAgent,
  updateAgentStatus,
  getCredentialsStatus,
  hasRequiredCredentials,
  getAllowedModels,
  type Agent,
} from '../../db/repositories/agent-repository.js';
import {
  canCreateAgent,
  findCustomerById,
} from '../../db/repositories/customer-repository.js';
import { setAuditAction } from '../middleware/audit.js';
import { publishAgentCommand } from '../../services/agent-manager.js';

const router = Router();

// Validation schemas
const createAgentSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(50)
    .optional(),
  systemPrompt: z.string().max(10000).optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().min(256).max(8192).optional(),
  temperature: z.number().min(0).max(1).optional(),
  telegramAllowFrom: z.array(z.string()).optional(),
  telegramGroupPolicy: z.enum(['open', 'disabled', 'allowlist']).optional(),
  telegramDmPolicy: z.enum(['pairing', 'allowlist', 'open', 'disabled']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  systemPrompt: z.string().max(10000).optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().min(256).max(8192).optional(),
  temperature: z.number().min(0).max(1).optional(),
  telegramAllowFrom: z.array(z.string()).optional(),
  telegramGroupPolicy: z.enum(['open', 'disabled', 'allowlist']).optional(),
  telegramDmPolicy: z.enum(['pairing', 'allowlist', 'open', 'disabled']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listAgentsSchema = z.object({
  status: z.enum(['created', 'ready', 'running', 'stopped', 'error']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Create a new agent
 * POST /api/v1/agents
 */
router.post('/', async (req, res) => {
  try {
    const customer = req.customer!;
    const input = createAgentSchema.parse(req.body);

    // Check if customer can create more agents
    const canCreate = await canCreateAgent(customer.id);
    if (!canCreate) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Agent limit reached. Your plan allows ${customer.maxAgents} agent(s)`,
      });
      return;
    }

    // Validate model if provided
    if (input.model) {
      const allowedModels = getAllowedModels();
      if (!allowedModels.includes(input.model)) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Invalid model. Allowed models: ${allowedModels.join(', ')}`,
        });
        return;
      }
    }

    setAuditAction(req, 'agent.create', 'agent');

    const agent = await createAgent({
      customerId: customer.id,
      ...input,
    });

    req.audit!.resourceId = agent.id;

    res.status(201).json({
      agent: formatAgent(agent),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }

    // Handle unique constraint violation
    if ((error as NodeJS.ErrnoException).code === '23505') {
      res.status(409).json({
        error: 'Conflict',
        message: 'An agent with this slug already exists',
      });
      return;
    }

    console.error('[Agents] Create agent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create agent',
    });
  }
});

/**
 * List agents for customer
 * GET /api/v1/agents
 */
router.get('/', async (req, res) => {
  try {
    const customer = req.customer!;
    const params = listAgentsSchema.parse(req.query);

    const { agents, total } = await listAgentsForCustomer(customer.id, params);

    res.json({
      agents: agents.map(formatAgent),
      total,
      limit: params.limit || 50,
      offset: params.offset || 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }

    console.error('[Agents] List agents error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list agents',
    });
  }
});

/**
 * Get an agent by ID
 * GET /api/v1/agents/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const customer = req.customer!;
    const agent = await findAgentByIdForCustomer(req.params.id, customer.id);

    if (!agent) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
      return;
    }

    // Also get credentials status
    const credentials = await getCredentialsStatus(agent.id);

    res.json({
      agent: formatAgent(agent),
      credentials: credentials
        ? {
            hasTelegram: credentials.hasTelegram,
            telegramBotUsername: credentials.telegramBotUsername,
            telegramValidated: !!credentials.telegramValidatedAt,
            hasClaude: credentials.hasClaude,
            claudeValidated: !!credentials.claudeValidatedAt,
          }
        : null,
    });
  } catch (error) {
    console.error('[Agents] Get agent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get agent',
    });
  }
});

/**
 * Update an agent
 * PATCH /api/v1/agents/:id
 */
router.patch('/:id', async (req, res) => {
  try {
    const customer = req.customer!;
    const input = updateAgentSchema.parse(req.body);

    setAuditAction(req, 'agent.update', 'agent', req.params.id);

    const agent = await updateAgent(req.params.id, customer.id, input);

    if (!agent) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
      return;
    }

    res.json({
      agent: formatAgent(agent),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error && error.message.includes('Invalid')) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message,
      });
      return;
    }

    console.error('[Agents] Update agent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update agent',
    });
  }
});

/**
 * Delete an agent
 * DELETE /api/v1/agents/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const customer = req.customer!;

    // Check if agent exists and is owned by customer
    const agent = await findAgentByIdForCustomer(req.params.id, customer.id);
    if (!agent) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
      return;
    }

    // Stop agent if running
    if (agent.status === 'running') {
      await publishAgentCommand(agent.id, 'stop');
    }

    setAuditAction(req, 'agent.delete', 'agent', req.params.id);

    await deleteAgent(req.params.id, customer.id);

    res.status(204).send();
  } catch (error) {
    console.error('[Agents] Delete agent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete agent',
    });
  }
});

/**
 * Start an agent
 * POST /api/v1/agents/:id/start
 */
router.post('/:id/start', async (req, res) => {
  try {
    const customer = req.customer!;
    const agent = await findAgentByIdForCustomer(req.params.id, customer.id);

    if (!agent) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
      return;
    }

    if (agent.status === 'running') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Agent is already running',
      });
      return;
    }

    // Check if credentials are configured
    const hasCredentials = await hasRequiredCredentials(agent.id);
    if (!hasCredentials) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Agent requires both Telegram and Claude credentials to start',
      });
      return;
    }

    setAuditAction(req, 'agent.start', 'agent', req.params.id);

    // Update status to running (worker will pick it up)
    const updatedAgent = await updateAgentStatus(agent.id, 'running');

    // Publish start command to worker queue
    await publishAgentCommand(agent.id, 'start');

    res.json({
      agent: formatAgent(updatedAgent!),
      message: 'Agent start command sent',
    });
  } catch (error) {
    console.error('[Agents] Start agent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start agent',
    });
  }
});

/**
 * Stop an agent
 * POST /api/v1/agents/:id/stop
 */
router.post('/:id/stop', async (req, res) => {
  try {
    const customer = req.customer!;
    const agent = await findAgentByIdForCustomer(req.params.id, customer.id);

    if (!agent) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
      return;
    }

    if (agent.status !== 'running') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Agent is not running',
      });
      return;
    }

    setAuditAction(req, 'agent.stop', 'agent', req.params.id);

    // Publish stop command
    await publishAgentCommand(agent.id, 'stop');

    // Update status to stopped
    const updatedAgent = await updateAgentStatus(agent.id, 'stopped');

    res.json({
      agent: formatAgent(updatedAgent!),
      message: 'Agent stop command sent',
    });
  } catch (error) {
    console.error('[Agents] Stop agent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to stop agent',
    });
  }
});

/**
 * Restart an agent
 * POST /api/v1/agents/:id/restart
 */
router.post('/:id/restart', async (req, res) => {
  try {
    const customer = req.customer!;
    const agent = await findAgentByIdForCustomer(req.params.id, customer.id);

    if (!agent) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
      return;
    }

    // Check if credentials are configured
    const hasCredentials = await hasRequiredCredentials(agent.id);
    if (!hasCredentials) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Agent requires both Telegram and Claude credentials to start',
      });
      return;
    }

    setAuditAction(req, 'agent.start', 'agent', req.params.id, { restart: true });

    // Publish restart command
    await publishAgentCommand(agent.id, 'restart');

    // Update status to running
    const updatedAgent = await updateAgentStatus(agent.id, 'running');

    res.json({
      agent: formatAgent(updatedAgent!),
      message: 'Agent restart command sent',
    });
  } catch (error) {
    console.error('[Agents] Restart agent error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to restart agent',
    });
  }
});

/**
 * Get agent runtime status
 * GET /api/v1/agents/:id/status
 */
router.get('/:id/status', async (req, res) => {
  try {
    const customer = req.customer!;
    const agent = await findAgentByIdForCustomer(req.params.id, customer.id);

    if (!agent) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
      return;
    }

    const credentials = await getCredentialsStatus(agent.id);

    res.json({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      workerId: agent.workerId,
      workerAssignedAt: agent.workerAssignedAt?.toISOString() || null,
      lastActiveAt: agent.lastActiveAt?.toISOString() || null,
      messageCount: agent.messageCount,
      errorCount: agent.errorCount,
      credentials: credentials
        ? {
            telegramConfigured: credentials.hasTelegram,
            telegramValidated: !!credentials.telegramValidatedAt,
            telegramWebhookConfigured: credentials.telegramWebhookConfigured,
            claudeConfigured: credentials.hasClaude,
            claudeValidated: !!credentials.claudeValidatedAt,
          }
        : null,
    });
  } catch (error) {
    console.error('[Agents] Get status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get agent status',
    });
  }
});

/**
 * Get agent statistics
 * GET /api/v1/agents/:id/stats
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const customer = req.customer!;
    const agent = await findAgentByIdForCustomer(req.params.id, customer.id);

    if (!agent) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
      return;
    }

    // TODO: Implement detailed statistics from session data
    res.json({
      id: agent.id,
      messageCount: agent.messageCount,
      errorCount: agent.errorCount,
      lastActiveAt: agent.lastActiveAt?.toISOString() || null,
      createdAt: agent.createdAt.toISOString(),
      uptime: agent.status === 'running' && agent.workerAssignedAt
        ? Date.now() - agent.workerAssignedAt.getTime()
        : 0,
    });
  } catch (error) {
    console.error('[Agents] Get stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get agent statistics',
    });
  }
});

/**
 * Get allowed models
 * GET /api/v1/agents/models
 */
router.get('/config/models', async (_req, res) => {
  res.json({
    models: getAllowedModels(),
  });
});

/**
 * Format agent for API response
 */
function formatAgent(agent: Agent): Record<string, unknown> {
  return {
    id: agent.id,
    name: agent.name,
    slug: agent.slug,
    status: agent.status,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    maxTokens: agent.maxTokens,
    temperature: agent.temperature,
    telegramAllowFrom: agent.telegramAllowFrom,
    telegramGroupPolicy: agent.telegramGroupPolicy,
    telegramDmPolicy: agent.telegramDmPolicy,
    lastActiveAt: agent.lastActiveAt?.toISOString() || null,
    messageCount: agent.messageCount,
    errorCount: agent.errorCount,
    metadata: agent.metadata,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

export default router;
