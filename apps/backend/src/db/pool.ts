import { Pool } from 'pg';

/** How long a caller may wait for a connection from the main pool (also while every connection is busy). */
const POOL_CONNECTION_TIMEOUT_MS = 10_000;

/**
 * The pool behind `db`, used by every route. It sets no query timeout: a bulk upsert or a chart
 * query over a lot of history may legitimately run for longer than a request would wait. /health has its own probe
 * (health-probe.ts) with tight limits instead.
 */
export function createPool(connectionString: string): Pool {
    const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS });

    // An idle client erroring (a database restart) is emitted on the pool; unhandled, it would crash the process.
    pool.on('error', () => undefined);

    return pool;
}
