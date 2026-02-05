/**
 * Database Migration Runner
 *
 * Runs SQL migrations in order. Used by Heroku release phase.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializePool, query, closePool } from '../db/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');

interface Migration {
  id: number;
  name: string;
  appliedAt: Date;
}

/**
 * Ensure migrations table exists
 */
async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(): Promise<string[]> {
  const result = await query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map((row) => row.name as string);
}

/**
 * Get list of pending migrations
 */
async function getPendingMigrations(): Promise<string[]> {
  const applied = new Set(await getAppliedMigrations());

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.filter((f) => !applied.has(f));
}

/**
 * Run a single migration
 */
async function runMigration(filename: string): Promise<void> {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  console.log(`[Migration] Running: ${filename}`);

  await query('BEGIN');

  try {
    // Execute migration SQL
    await query(sql);

    // Record migration
    await query('INSERT INTO migrations (name) VALUES ($1)', [filename]);

    await query('COMMIT');
    console.log(`[Migration] Completed: ${filename}`);
  } catch (error) {
    await query('ROLLBACK');
    console.error(`[Migration] Failed: ${filename}`);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
async function runMigrations(): Promise<void> {
  console.log('[Migration] Starting migrations...');

  // Initialize database connection
  initializePool();

  try {
    // Ensure migrations table exists
    await ensureMigrationsTable();

    // Get pending migrations
    const pending = await getPendingMigrations();

    if (pending.length === 0) {
      console.log('[Migration] No pending migrations');
      return;
    }

    console.log(`[Migration] Found ${pending.length} pending migration(s)`);

    // Run each migration
    for (const migration of pending) {
      await runMigration(migration);
    }

    console.log('[Migration] All migrations completed successfully');
  } finally {
    await closePool();
  }
}

/**
 * Rollback the last migration (for development)
 */
async function rollbackMigration(): Promise<void> {
  console.log('[Migration] Rolling back last migration...');

  initializePool();

  try {
    await ensureMigrationsTable();

    const result = await query(
      'SELECT name FROM migrations ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      console.log('[Migration] No migrations to rollback');
      return;
    }

    const lastMigration = result.rows[0].name as string;
    console.log(`[Migration] Rolling back: ${lastMigration}`);

    // Check for rollback file
    const rollbackFile = path.join(
      MIGRATIONS_DIR,
      lastMigration.replace('.sql', '.rollback.sql')
    );

    if (fs.existsSync(rollbackFile)) {
      const sql = fs.readFileSync(rollbackFile, 'utf8');
      await query('BEGIN');
      await query(sql);
      await query('DELETE FROM migrations WHERE name = $1', [lastMigration]);
      await query('COMMIT');
      console.log(`[Migration] Rolled back: ${lastMigration}`);
    } else {
      console.error(`[Migration] No rollback file found: ${rollbackFile}`);
      process.exit(1);
    }
  } finally {
    await closePool();
  }
}

/**
 * Show migration status
 */
async function showStatus(): Promise<void> {
  initializePool();

  try {
    await ensureMigrationsTable();

    const applied = await getAppliedMigrations();
    const pending = await getPendingMigrations();

    console.log('\n[Migration] Status:');
    console.log('==================');

    if (applied.length > 0) {
      console.log('\nApplied migrations:');
      applied.forEach((m) => console.log(`  ✓ ${m}`));
    }

    if (pending.length > 0) {
      console.log('\nPending migrations:');
      pending.forEach((m) => console.log(`  ○ ${m}`));
    }

    if (applied.length === 0 && pending.length === 0) {
      console.log('  No migrations found');
    }

    console.log('');
  } finally {
    await closePool();
  }
}

// CLI handling
const command = process.argv[2] || 'run';

switch (command) {
  case 'run':
    runMigrations().catch((err) => {
      console.error('[Migration] Error:', err);
      process.exit(1);
    });
    break;
  case 'rollback':
    rollbackMigration().catch((err) => {
      console.error('[Migration] Error:', err);
      process.exit(1);
    });
    break;
  case 'status':
    showStatus().catch((err) => {
      console.error('[Migration] Error:', err);
      process.exit(1);
    });
    break;
  default:
    console.log('Usage: run-migrations.ts [run|rollback|status]');
    process.exit(1);
}
