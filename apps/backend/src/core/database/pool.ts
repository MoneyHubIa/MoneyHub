import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions/db-connections';
import { loadDatabasePoolMax, loadDatabasePoolIdleTimeoutMs } from '../runtime-config/runtime-config.js';

/** Each warm instance shares a small client pool; the external pooler controls the database budget. */
export function createDatabasePool(databaseUrl: string, environment: NodeJS.ProcessEnv = process.env): pg.Pool {
  const sslMode = new URL(databaseUrl).searchParams.get('sslmode');
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
    max: loadDatabasePoolMax(environment),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: loadDatabasePoolIdleTimeoutMs(environment),
    maxLifetimeSeconds: 300,
    allowExitOnIdle: true
  });
  if (environment.VERCEL === '1') attachDatabasePool(pool);
  return pool;
}
