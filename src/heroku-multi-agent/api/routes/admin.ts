/**
 * Admin Routes
 *
 * Customer management endpoints for administrators.
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  createCustomer,
  findCustomerById,
  listCustomers,
  updateCustomer,
  deleteCustomer,
  rotateApiKey,
  type Customer,
} from '../../db/repositories/customer-repository.js';
import { setAuditAction } from '../middleware/audit.js';

const router = Router();

// Validation schemas
const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  maxAgents: z.number().int().min(1).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
  webhookUrl: z.string().url().optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  maxAgents: z.number().int().min(1).max(100).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  metadata: z.record(z.unknown()).optional(),
  webhookUrl: z.string().url().nullable().optional(),
});

const listCustomersSchema = z.object({
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Create a new customer
 * POST /api/v1/admin/customers
 */
router.post('/customers', async (req, res) => {
  try {
    const input = createCustomerSchema.parse(req.body);

    setAuditAction(req, 'customer.create', 'customer');

    const { customer, apiKey } = await createCustomer(input);

    req.audit!.resourceId = customer.id;

    res.status(201).json({
      customer: formatCustomer(customer),
      apiKey, // Only returned on creation
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
        message: 'A customer with this email already exists',
      });
      return;
    }

    console.error('[Admin] Create customer error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create customer',
    });
  }
});

/**
 * List all customers
 * GET /api/v1/admin/customers
 */
router.get('/customers', async (req, res) => {
  try {
    const params = listCustomersSchema.parse(req.query);

    const { customers, total } = await listCustomers(params);

    res.json({
      customers: customers.map(formatCustomer),
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

    console.error('[Admin] List customers error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list customers',
    });
  }
});

/**
 * Get a customer by ID
 * GET /api/v1/admin/customers/:id
 */
router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await findCustomerById(req.params.id);

    if (!customer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Customer not found',
      });
      return;
    }

    res.json({
      customer: formatCustomer(customer),
    });
  } catch (error) {
    console.error('[Admin] Get customer error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get customer',
    });
  }
});

/**
 * Update a customer
 * PATCH /api/v1/admin/customers/:id
 */
router.patch('/customers/:id', async (req, res) => {
  try {
    const input = updateCustomerSchema.parse(req.body);

    setAuditAction(req, 'customer.update', 'customer', req.params.id);

    const customer = await updateCustomer(req.params.id, input);

    if (!customer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Customer not found',
      });
      return;
    }

    res.json({
      customer: formatCustomer(customer),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }

    console.error('[Admin] Update customer error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update customer',
    });
  }
});

/**
 * Delete a customer
 * DELETE /api/v1/admin/customers/:id
 */
router.delete('/customers/:id', async (req, res) => {
  try {
    setAuditAction(req, 'customer.delete', 'customer', req.params.id);

    const deleted = await deleteCustomer(req.params.id);

    if (!deleted) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Customer not found',
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('[Admin] Delete customer error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete customer',
    });
  }
});

/**
 * Rotate customer API key
 * POST /api/v1/admin/customers/:id/rotate-key
 */
router.post('/customers/:id/rotate-key', async (req, res) => {
  try {
    setAuditAction(req, 'customer.rotate_key', 'customer', req.params.id);

    const result = await rotateApiKey(req.params.id);

    if (!result) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Customer not found or inactive',
      });
      return;
    }

    res.json({
      customer: formatCustomer(result.customer),
      apiKey: result.apiKey, // New API key
    });
  } catch (error) {
    console.error('[Admin] Rotate API key error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to rotate API key',
    });
  }
});

/**
 * Format customer for API response
 */
function formatCustomer(customer: Customer): Record<string, unknown> {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    apiKeyPrefix: customer.apiKeyPrefix,
    plan: customer.plan,
    maxAgents: customer.maxAgents,
    status: customer.status,
    metadata: customer.metadata,
    webhookUrl: customer.webhookUrl,
    hasWebhookSecret: !!customer.webhookSecret,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export default router;
