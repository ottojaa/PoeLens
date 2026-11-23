import { Pool } from 'pg';
import { env } from '../config/env.js';

/** The most /health may wait on Postgres: it has to answer "degraded" within about 2 s even when the database hangs. */
export const PROBE_TIMEOUT_MS = 1_500;

/** The whole probe, connect and query together, is abandoned after this. */
const PROBE_DEADLINE_MS = 1_800;

let probePool: Pool | null = null;

// Its own single-connection pool: the limits below apply to the probe only, and a busy main pool (the collector writing
// a snapshot) can neither delay nor fail the probe.
function getProbePool(): Pool {
    if (probePool) return probePool;

    probePool = new Pool({
        connectionString: env.DATABASE_URL,
        max: 1,
        // Covers a database that is down or unreachable...
        connectionTimeoutMillis: PROBE_TIMEOUT_MS,
        // ...and one that accepts the connection and then never answers.
        query_timeout: PROBE_TIMEOUT_MS,
    });
    probePool.on('error', () => undefined);

    return probePool;
}

/** True when Postgres answers a trivial query in time. Never throws. */
export async function checkDbConnection(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    // The connect and query limits above add up (a slow accept, then a stalled query), so one timer bounds the whole probe.
    const deadline = new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), PROBE_DEADLINE_MS);
    });
    const probe = getProbePool()
        .query('SELECT 1')
        .then(() => true)
        .catch(() => false);

    try {
        return await Promise.race([probe, deadline]);
    } finally {
        clearTimeout(timer);
    }
}

export async function closeHealthProbe(): Promise<void> {
    await probePool?.end().catch(() => undefined);
    probePool = null;
}
