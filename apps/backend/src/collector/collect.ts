import { Pool } from 'pg';
import { env } from '../config/env.js';
import { db } from '../db/kysely.js';
import { createCollector } from './index.js';
import { withCollectorLock } from './lock.js';

/**
 * Runs one collection cycle now, under the same lock as the scheduler, and prints its summary.
 * Dev: `nx run @poelens/backend:collect`. Production: `node dist/apps/backend/src/collector/collect.js`.
 * It ignores COLLECTOR_ENABLED: the switch only controls whether the server polls on its own.
 */
async function main(): Promise<void> {
    const collector = createCollector({ db, contact: env.COLLECTOR_CONTACT, leagues: env.COLLECTOR_LEAGUES });
    const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });

    try {
        const result = await withCollectorLock(pool, async () => {
            await collector.store.abandonStaleRuns(new Date());

            return collector.runCycle();
        });

        if (!result.ran) {
            console.error('Another collector cycle is running; nothing done');
            process.exitCode = 1;

            return;
        }

        console.log(JSON.stringify(result.value, null, 2));
        process.exitCode = result.value.status === 'failed' ? 1 : 0;
    } finally {
        await pool.end();
        await db.destroy();
    }
}

main().catch((error: unknown) => {
    console.error('Collector cycle failed:', error);
    process.exit(1);
});
