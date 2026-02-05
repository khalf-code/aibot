/**
 * Database client for multi-agent Heroku SaaS
 *
 * Uses node-postgres (pg) for PostgreSQL connections with connection pooling.
 */

import pg from 'pg';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

const { Pool: PgPool } = pg;

// Environment configuration
const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_SSL = process.env.DATABASE_SSL !== 'false';
const DATABASE_POOL_MIN = parseInt(process.env.DATABASE_POOL_MIN || '2', 10);
const DATABASE_POOL_MAX = parseInt(process.env.DATABASE_POOL_MAX || '10', 10);

// Type definitions
export interface DatabaseConfig {
  connectionString?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface TransactionCallback<T> {
  (client: PoolClient): Promise<T>;
}

// Singleton pool instance
let pool: Pool | null = null;

/**
 * Initialize the database connection pool
 */
export function initializePool(config?: DatabaseConfig): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = config?.connectionString || DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  pool = new PgPool({
    connectionString,
    ssl: config?.ssl ?? (DATABASE_SSL ? { rejectUnauthorized: false } : false),
    min: config?.min ?? DATABASE_POOL_MIN,
    max: config?.max ?? DATABASE_POOL_MAX,
    idleTimeoutMillis: config?.idleTimeoutMillis ?? 30000,
    connectionTimeoutMillis: config?.connectionTimeoutMillis ?? 10000,
  });

  // Error handling
  pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
  });

  pool.on('connect', () => {
    console.log('[DB] New client connected to pool');
  });

  return pool;
}

/**
 * Get the database pool (initializes if needed)
 */
export function getPool(): Pool {
  if (!pool) {
    return initializePool();
  }
  return pool;
}

/**
 * Execute a query with parameters
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await getPool().query<T>(text, params);
  const duration = Date.now() - start;

  if (process.env.LOG_QUERIES === 'true') {
    console.log('[DB Query]', {
      text: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
  }

  return result;
}

/**
 * Execute a query and return a single row or null
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all rows
 */
export async function queryMany<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * Execute a transaction with automatic commit/rollback
 */
export async function transaction<T>(callback: TransactionCallback<T>): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check database connectivity
 */
export async function healthCheck(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const start = Date.now();

  try {
    await query('SELECT 1');
    return {
      ok: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      ok: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Close the connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[DB] Connection pool closed');
  }
}

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  console.log('[DB] Running migrations...');

  // Create migrations table if not exists
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Note: In production, use a proper migration tool like node-pg-migrate
  // This is a simplified version for the example
  console.log('[DB] Migrations complete');
}

// Export types
export type { Pool, PoolClient, QueryResult, QueryResultRow };
