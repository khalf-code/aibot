/**
 * Rate Limiting Middleware
 *
 * Implements tiered rate limiting based on customer plan.
 */

import type { Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../../db/client.js';

// Rate limit configuration by plan
const RATE_LIMITS: Record<
  string,
  {
    api: { requests: number; windowMs: number };
    messages: { requests: number; windowMs: number };
  }
> = {
  free: {
    api: { requests: 100, windowMs: 60 * 60 * 1000 }, // 100/hour
    messages: { requests: 100, windowMs: 24 * 60 * 60 * 1000 }, // 100/day
  },
  pro: {
    api: { requests: 1000, windowMs: 60 * 60 * 1000 }, // 1000/hour
    messages: { requests: 1000, windowMs: 24 * 60 * 60 * 1000 }, // 1000/day
  },
  enterprise: {
    api: { requests: 10000, windowMs: 60 * 60 * 1000 }, // 10000/hour
    messages: { requests: 10000, windowMs: 24 * 60 * 60 * 1000 }, // 10000/day
  },
};

// In-memory rate limit cache (use Redis in production)
const rateLimitCache = new Map<
  string,
  {
    count: number;
    windowStart: Date;
    windowEnd: Date;
  }
>();

/**
 * Get rate limit configuration for a plan
 */
function getRateLimitConfig(plan: string, limitType: 'api' | 'messages') {
  return RATE_LIMITS[plan]?.[limitType] || RATE_LIMITS.free[limitType];
}

/**
 * Generate cache key for rate limiting
 */
function getCacheKey(customerId: string, limitType: string): string {
  return `${customerId}:${limitType}`;
}

/**
 * Check and update rate limit
 */
async function checkRateLimit(
  customerId: string,
  plan: string,
  limitType: 'api' | 'messages'
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}> {
  const config = getRateLimitConfig(plan, limitType);
  const cacheKey = getCacheKey(customerId, limitType);
  const now = new Date();

  // Check cache first
  let cached = rateLimitCache.get(cacheKey);

  // If no cache or window expired, create new window
  if (!cached || cached.windowEnd < now) {
    const windowStart = now;
    const windowEnd = new Date(now.getTime() + config.windowMs);

    cached = {
      count: 0,
      windowStart,
      windowEnd,
    };
  }

  // Check if within limit
  const allowed = cached.count < config.requests;
  const remaining = Math.max(0, config.requests - cached.count - 1);

  if (allowed) {
    // Increment count
    cached.count++;
    rateLimitCache.set(cacheKey, cached);

    // Persist to database periodically (every 10 requests)
    if (cached.count % 10 === 0) {
      persistRateLimitToDb(customerId, limitType, cached.windowStart, cached.windowEnd, cached.count).catch(
        (err) => console.error('[RateLimit] Failed to persist:', err)
      );
    }
  }

  return {
    allowed,
    remaining,
    resetAt: cached.windowEnd,
    limit: config.requests,
  };
}

/**
 * Persist rate limit to database
 */
async function persistRateLimitToDb(
  customerId: string,
  limitType: string,
  windowStart: Date,
  windowEnd: Date,
  count: number
): Promise<void> {
  await query(
    `INSERT INTO rate_limits (customer_id, limit_type, window_start, window_end, request_count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (customer_id, limit_type, window_start) DO UPDATE SET
       request_count = $5`,
    [customerId, limitType, windowStart, windowEnd, count]
  );
}

/**
 * API rate limiting middleware
 */
export function apiRateLimit() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if no customer (admin or unauthenticated)
    if (!req.customer) {
      next();
      return;
    }

    try {
      const result = await checkRateLimit(req.customer.id, req.customer.plan, 'api');

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000));

      if (!result.allowed) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: `API rate limit exceeded. Limit: ${result.limit} requests per hour`,
          resetAt: result.resetAt.toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      console.error('[RateLimit] Error:', error);
      // Allow request on error (fail open)
      next();
    }
  };
}

/**
 * Message rate limiting middleware
 */
export function messageRateLimit() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.customer) {
      next();
      return;
    }

    try {
      const result = await checkRateLimit(req.customer.id, req.customer.plan, 'messages');

      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000));

      if (!result.allowed) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: `Message rate limit exceeded. Limit: ${result.limit} messages per day`,
          resetAt: result.resetAt.toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      console.error('[RateLimit] Error:', error);
      next();
    }
  };
}

/**
 * Get rate limit status for a customer
 */
export async function getRateLimitStatus(
  customerId: string,
  plan: string
): Promise<{
  api: { used: number; limit: number; resetAt: Date };
  messages: { used: number; limit: number; resetAt: Date };
}> {
  const apiConfig = getRateLimitConfig(plan, 'api');
  const messagesConfig = getRateLimitConfig(plan, 'messages');

  const apiCacheKey = getCacheKey(customerId, 'api');
  const messagesCacheKey = getCacheKey(customerId, 'messages');

  const now = new Date();

  const apiCached = rateLimitCache.get(apiCacheKey);
  const messagesCached = rateLimitCache.get(messagesCacheKey);

  return {
    api: {
      used: apiCached && apiCached.windowEnd > now ? apiCached.count : 0,
      limit: apiConfig.requests,
      resetAt: apiCached?.windowEnd || new Date(now.getTime() + apiConfig.windowMs),
    },
    messages: {
      used: messagesCached && messagesCached.windowEnd > now ? messagesCached.count : 0,
      limit: messagesConfig.requests,
      resetAt: messagesCached?.windowEnd || new Date(now.getTime() + messagesConfig.windowMs),
    },
  };
}

/**
 * Clear rate limit cache (for testing)
 */
export function clearRateLimitCache(): void {
  rateLimitCache.clear();
}
