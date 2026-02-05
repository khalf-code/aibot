/**
 * Authentication Middleware
 *
 * Handles API key authentication and admin authentication.
 */

import type { Request, Response, NextFunction } from 'express';
import { findCustomerByApiKey, type Customer } from '../../db/repositories/customer-repository.js';
import { hashApiKey } from '../../services/encryption.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      customer?: Customer;
      isAdmin?: boolean;
    }
  }
}

// Admin API key from environment
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

/**
 * Extract API key from request
 */
function extractApiKey(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  // Check query parameter (not recommended, but useful for testing)
  if (typeof req.query.api_key === 'string') {
    return req.query.api_key;
  }

  return null;
}

/**
 * Customer authentication middleware
 * Requires a valid customer API key
 */
export async function customerAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required',
      });
      return;
    }

    // Check if it's an admin key first
    if (ADMIN_API_KEY && apiKey === ADMIN_API_KEY) {
      req.isAdmin = true;
      next();
      return;
    }

    // Look up customer by API key
    const customer = await findCustomerByApiKey(apiKey);

    if (!customer) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
      return;
    }

    if (customer.status !== 'active') {
      res.status(403).json({
        error: 'Forbidden',
        message: `Account is ${customer.status}`,
      });
      return;
    }

    req.customer = customer;
    next();
  } catch (error) {
    console.error('[Auth] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Admin authentication middleware
 * Requires the admin API key
 */
export async function adminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required',
      });
      return;
    }

    if (!ADMIN_API_KEY) {
      res.status(500).json({
        error: 'Configuration Error',
        message: 'Admin API key not configured',
      });
      return;
    }

    if (apiKey !== ADMIN_API_KEY) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    req.isAdmin = true;
    next();
  } catch (error) {
    console.error('[Auth] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication middleware
 * Sets customer if valid key provided, but doesn't require it
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = extractApiKey(req);

    if (apiKey) {
      if (ADMIN_API_KEY && apiKey === ADMIN_API_KEY) {
        req.isAdmin = true;
      } else {
        const customer = await findCustomerByApiKey(apiKey);
        if (customer && customer.status === 'active') {
          req.customer = customer;
        }
      }
    }

    next();
  } catch (error) {
    console.error('[Auth] Optional auth error:', error);
    next();
  }
}

/**
 * Require customer to be set on request
 * Use after customerAuth middleware
 */
export function requireCustomer(req: Request, res: Response, next: NextFunction): void {
  if (!req.customer && !req.isAdmin) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Customer authentication required',
    });
    return;
  }
  next();
}

/**
 * Require admin to be set on request
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAdmin) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
    return;
  }
  next();
}
