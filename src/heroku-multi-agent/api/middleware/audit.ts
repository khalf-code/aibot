/**
 * Audit Logging Middleware
 *
 * Logs all API operations for security and compliance.
 */

import type { Request, Response, NextFunction } from 'express';
import { query } from '../../db/client.js';

// Audit action types
export type AuditAction =
  | 'customer.create'
  | 'customer.update'
  | 'customer.delete'
  | 'customer.rotate_key'
  | 'agent.create'
  | 'agent.update'
  | 'agent.delete'
  | 'agent.start'
  | 'agent.stop'
  | 'credentials.set'
  | 'credentials.delete'
  | 'credentials.validate'
  | 'session.create'
  | 'session.delete'
  | 'webhook.create'
  | 'webhook.delete';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      audit?: {
        action?: AuditAction;
        resourceType?: string;
        resourceId?: string;
        additionalData?: Record<string, unknown>;
      };
    }
  }
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: {
  customerId?: string;
  agentId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestData?: Record<string, unknown>;
  responseStatus?: number;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (
        customer_id, agent_id, action, resource_type, resource_id,
        ip_address, user_agent, request_data, response_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        params.customerId || null,
        params.agentId || null,
        params.action,
        params.resourceType || null,
        params.resourceId || null,
        params.ipAddress || null,
        params.userAgent || null,
        params.requestData ? JSON.stringify(sanitizeRequestData(params.requestData)) : null,
        params.responseStatus || null,
      ]
    );
  } catch (error) {
    console.error('[Audit] Failed to create log:', error);
  }
}

/**
 * Sanitize request data to remove sensitive fields
 */
function sanitizeRequestData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    'password',
    'apiKey',
    'api_key',
    'token',
    'botToken',
    'bot_token',
    'claude_api_key',
    'claudeApiKey',
    'secret',
    'credential',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeRequestData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string | null {
  // Check X-Forwarded-For header (for proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  // Fall back to socket address
  return req.socket.remoteAddress || null;
}

/**
 * Audit logging middleware
 * Captures request details and logs after response
 */
export function auditMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Initialize audit context
    req.audit = {};

    // Capture original end function
    const originalEnd = res.end;
    const startTime = Date.now();

    // Override end to capture response
    res.end = function (
      this: Response,
      chunk?: unknown,
      encoding?: BufferEncoding | (() => void),
      callback?: () => void
    ): Response {
      // Only log if audit action was set
      if (req.audit?.action) {
        const duration = Date.now() - startTime;

        createAuditLog({
          customerId: req.customer?.id,
          agentId: req.audit.resourceType === 'agent' ? req.audit.resourceId : undefined,
          action: req.audit.action,
          resourceType: req.audit.resourceType,
          resourceId: req.audit.resourceId,
          ipAddress: getClientIp(req) || undefined,
          userAgent: req.headers['user-agent'],
          requestData: {
            method: req.method,
            path: req.path,
            query: req.query,
            body: req.body,
            duration,
            ...req.audit.additionalData,
          },
          responseStatus: res.statusCode,
        });
      }

      // Call original end
      if (typeof encoding === 'function') {
        return originalEnd.call(this, chunk, encoding);
      }
      return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
  };
}

/**
 * Helper to set audit action in request handler
 */
export function setAuditAction(
  req: Request,
  action: AuditAction,
  resourceType?: string,
  resourceId?: string,
  additionalData?: Record<string, unknown>
): void {
  if (!req.audit) {
    req.audit = {};
  }
  req.audit.action = action;
  req.audit.resourceType = resourceType;
  req.audit.resourceId = resourceId;
  req.audit.additionalData = additionalData;
}

/**
 * Query audit logs
 */
export async function queryAuditLogs(params: {
  customerId?: string;
  agentId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{
  logs: Array<{
    id: string;
    customerId: string | null;
    agentId: string | null;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    requestData: Record<string, unknown> | null;
    responseStatus: number | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];
  let paramIndex = 1;

  if (params.customerId) {
    conditions.push(`customer_id = $${paramIndex++}`);
    queryParams.push(params.customerId);
  }

  if (params.agentId) {
    conditions.push(`agent_id = $${paramIndex++}`);
    queryParams.push(params.agentId);
  }

  if (params.action) {
    conditions.push(`action = $${paramIndex++}`);
    queryParams.push(params.action);
  }

  if (params.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    queryParams.push(params.startDate);
  }

  if (params.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    queryParams.push(params.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  const [countResult, logsResult] = await Promise.all([
    query(`SELECT COUNT(*) as count FROM audit_logs ${whereClause}`, queryParams),
    query(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...queryParams, limit, offset]
    ),
  ]);

  return {
    logs: logsResult.rows.map((row) => ({
      id: row.id as string,
      customerId: row.customer_id as string | null,
      agentId: row.agent_id as string | null,
      action: row.action as string,
      resourceType: row.resource_type as string | null,
      resourceId: row.resource_id as string | null,
      ipAddress: row.ip_address as string | null,
      userAgent: row.user_agent as string | null,
      requestData: row.request_data as Record<string, unknown> | null,
      responseStatus: row.response_status as number | null,
      createdAt: new Date(row.created_at as string),
    })),
    total: parseInt((countResult.rows[0]?.count as string) || '0', 10),
  };
}
