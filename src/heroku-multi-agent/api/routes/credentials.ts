/**
 * Credentials Routes
 *
 * Secure credential management for agents.
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  findAgentByIdForCustomer,
  setTelegramCredentials,
  setClaudeCredentials,
  getTelegramToken,
  getClaudeApiKey,
  getCredentialsStatus,
  deleteTelegramCredentials,
  deleteClaudeCredentials,
  markTelegramValidated,
  markClaudeValidated,
  updateAgentStatus,
} from '../../db/repositories/agent-repository.js';
import { setAuditAction } from '../middleware/audit.js';
import { maskCredential } from '../../services/encryption.js';

const router = Router();

// Validation schemas
const setTelegramSchema = z.object({
  botToken: z.string().min(40).max(100),
  botUsername: z.string().max(100).optional(),
});

const setClaudeSchema = z.object({
  apiKey: z.string().min(40).max(200),
});

/**
 * Set Telegram credentials
 * PUT /api/v1/agents/:id/credentials/telegram
 */
router.put('/:id/credentials/telegram', async (req, res) => {
  try {
    const customer = req.customer!;
    const input = setTelegramSchema.parse(req.body);

    const agent = await findAgentByIdForCustomer(req.params.id, customer.id);
    if (!agent) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
      return;
    }

    setAuditAction(req, 'credentials.set', 'agent', req.params.id, {
      credentialType: 'telegram',
    });

    // Store encrypted credentials
    await setTelegramCredentials(
      agent.id,
      customer.id,
      input.botToken,
      input.botUsername
    );

    // If agent was in 'created' status and now has credentials, update to 'ready'
    if (agent.status === 'created') {
      const status = await getCredentialsStatus(agent.id);
      if (status?.hasClaude) {
        await updateAgentStatus(agent.id, 'ready');
      }
    }

    res.json({
      message: 'Telegram credentials saved',
      telegramBotUsername: input.botUsername || null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }

    console.error('[Credentials] Set Telegram error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to save Telegram credentials',
    });
  }
});

/**
 * Set Claude API credentials
 * PUT /api/v1/agents/:id/credentials/claude
 */
router.put('/:id/credentials/claude', async (req, res) => {
  try {
    const customer = req.customer!;
    const input = setClaudeSchema.parse(req.body);

    const agent = await findAgentByIdForCustomer(req.params.id, customer.id);
    if (!agent) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Agent not found',
      });
      return;
    }

    setAuditAction(req, 'credentials.set', 'agent', req.params.id, {
      credentialType: 'claude',
    });

    // Store encrypted credentials
    await setClaudeCredentials(agent.id, customer.id, input.apiKey);

    // If agent was in 'created' status and now has credentials, update to 'ready'
    if (agent.status === 'created') {
      const status = await getCredentialsStatus(agent.id);
      if (status?.hasTelegram) {
        await updateAgentStatus(agent.id, 'ready');
      }
    }

    res.json({
      message: 'Claude API credentials saved',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }

    console.error('[Credentials] Set Claude error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to save Claude API credentials',
    });
  }
});

/**
 * Delete Telegram credentials
 * DELETE /api/v1/agents/:id/credentials/telegram
 */
router.delete('/:id/credentials/telegram', async (req, res) => {
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

    // Can't delete credentials while agent is running
    if (agent.status === 'running') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Stop the agent before deleting credentials',
      });
      return;
    }

    setAuditAction(req, 'credentials.delete', 'agent', req.params.id, {
      credentialType: 'telegram',
    });

    await deleteTelegramCredentials(agent.id);

    // Update agent status to 'created' if it was 'ready'
    if (agent.status === 'ready' || agent.status === 'stopped') {
      await updateAgentStatus(agent.id, 'created');
    }

    res.json({
      message: 'Telegram credentials deleted',
    });
  } catch (error) {
    console.error('[Credentials] Delete Telegram error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete Telegram credentials',
    });
  }
});

/**
 * Delete Claude credentials
 * DELETE /api/v1/agents/:id/credentials/claude
 */
router.delete('/:id/credentials/claude', async (req, res) => {
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
        message: 'Stop the agent before deleting credentials',
      });
      return;
    }

    setAuditAction(req, 'credentials.delete', 'agent', req.params.id, {
      credentialType: 'claude',
    });

    await deleteClaudeCredentials(agent.id);

    if (agent.status === 'ready' || agent.status === 'stopped') {
      await updateAgentStatus(agent.id, 'created');
    }

    res.json({
      message: 'Claude API credentials deleted',
    });
  } catch (error) {
    console.error('[Credentials] Delete Claude error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete Claude API credentials',
    });
  }
});

/**
 * Get credentials status
 * GET /api/v1/agents/:id/credentials/status
 */
router.get('/:id/credentials/status', async (req, res) => {
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

    const status = await getCredentialsStatus(agent.id);

    if (!status) {
      res.json({
        telegram: { configured: false, validated: false },
        claude: { configured: false, validated: false },
      });
      return;
    }

    res.json({
      telegram: {
        configured: status.hasTelegram,
        botUsername: status.telegramBotUsername,
        webhookConfigured: status.telegramWebhookConfigured,
        validated: !!status.telegramValidatedAt,
        validatedAt: status.telegramValidatedAt?.toISOString() || null,
      },
      claude: {
        configured: status.hasClaude,
        validated: !!status.claudeValidatedAt,
        validatedAt: status.claudeValidatedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('[Credentials] Get status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get credentials status',
    });
  }
});

/**
 * Validate credentials
 * POST /api/v1/agents/:id/credentials/validate
 */
router.post('/:id/credentials/validate', async (req, res) => {
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

    setAuditAction(req, 'credentials.validate', 'agent', req.params.id);

    const results: {
      telegram?: { valid: boolean; error?: string; botInfo?: unknown };
      claude?: { valid: boolean; error?: string };
    } = {};

    // Validate Telegram credentials
    const telegramToken = await getTelegramToken(agent.id, customer.id);
    if (telegramToken) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${telegramToken}/getMe`);
        const data = await response.json() as { ok: boolean; result?: unknown; description?: string };

        if (data.ok) {
          results.telegram = { valid: true, botInfo: data.result };
          await markTelegramValidated(agent.id);
        } else {
          results.telegram = { valid: false, error: data.description || 'Invalid token' };
        }
      } catch (error) {
        results.telegram = {
          valid: false,
          error: error instanceof Error ? error.message : 'Network error',
        };
      }
    }

    // Validate Claude API credentials
    const claudeApiKey = await getClaudeApiKey(agent.id, customer.id);
    if (claudeApiKey) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-3-5-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });

        // 200 or 400 (invalid request) both indicate valid key
        // 401 indicates invalid key
        if (response.status === 401) {
          results.claude = { valid: false, error: 'Invalid API key' };
        } else {
          results.claude = { valid: true };
          await markClaudeValidated(agent.id);
        }
      } catch (error) {
        results.claude = {
          valid: false,
          error: error instanceof Error ? error.message : 'Network error',
        };
      }
    }

    res.json({
      validation: results,
      allValid: (results.telegram?.valid ?? true) && (results.claude?.valid ?? true),
    });
  } catch (error) {
    console.error('[Credentials] Validate error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate credentials',
    });
  }
});

export default router;
