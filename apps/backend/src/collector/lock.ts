import type { Pool } from 'pg';

/** The advisory lock key of the collector: a fixed number every PoeLens process agrees on ("poel" in ASCII). */
export const COLLECTOR_LOCK_KEY = 0x706f656c;

export type LockedResult<T> = { ran: true; value: T } | { ran: false };

/**
 * Runs `work` only if this process wins the collector's advisory lock, and holds the lock on one dedicated connection
 * for the whole of it. A process that loses (an old container during a deploy) returns `{ ran: false }` and skips the
 * cycle. The lock belongs to the connection, so a crash releases it and the next cycle starts clean.
 */
export async function withCollectorLock<T>(pool: Pool, work: () => Promise<T>): Promise<LockedResult<T>> {
    const client = await pool.connect();

    try {
        const { rows } = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [COLLECTOR_LOCK_KEY]);

        if (!rows[0]?.locked) return { ran: false };

        try {
            return { ran: true, value: await work() };
        } finally {
            await client.query('SELECT pg_advisory_unlock($1)', [COLLECTOR_LOCK_KEY]);
        }
    } finally {
        client.release();
    }
}
