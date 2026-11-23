import type { Kysely } from 'kysely';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import type { Database } from '../db/schema.js';
import { createCollector } from './index.js';
import { startScheduler } from './scheduler.js';

interface Logger {
    info(message: string): void;
    error(details: { err: unknown }, message: string): void;
}

export interface StartCollectorOptions {
    db: Kysely<Database>;
    log: Logger;
}

/** Starts the in-process scheduler and returns the function that stops it (waiting for a cycle in flight). */
export function startCollector({ db, log }: StartCollectorOptions): () => Promise<void> {
    const collector = createCollector({ db, contact: env.COLLECTOR_CONTACT, leagues: env.COLLECTOR_LEAGUES });
    const abort = new AbortController();
    // A pool of its own, so the lock connection (held for a whole cycle) never competes with the API's queries.
    const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });

    pool.on('error', () => undefined);

    const scheduler = startScheduler({
        pool,
        runCycle: async () => {
            const summary = await collector.runCycle(abort.signal);

            log.info(`Collector cycle ${summary.status}: ${summary.requests} requests, ${summary.stored} stored, ${summary.priceRows} price rows`);

            return summary;
        },
        abandonStaleRuns: () => collector.store.abandonStaleRuns(new Date()),
        loadLastStart: () => collector.store.findLastRunStart(collector.adapter.source, collector.adapter.game),
        onError: (message, error) => log.error({ err: error }, message),
    });

    return async () => {
        // Stops the request in flight too, so shutdown never waits out a slow poll.
        abort.abort();
        await scheduler.stop();
        await pool.end();
    };
}
