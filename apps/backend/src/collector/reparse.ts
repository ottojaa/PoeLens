import { Pool } from 'pg';
import { env } from '../config/env.js';
import { db } from '../db/kysely.js';
import { createCollector } from './index.js';
import { withCollectorLock } from './lock.js';
import { reparseRaw } from './reparse-raw.js';

const USAGE = 'Usage: reparse [--kind exchange|stash|leagues] [--category <type>] [--league <name>] [--from <ISO date>] [--to <ISO date>]';

function readFlag(args: string[], name: string): string | undefined {
    const index = args.indexOf(`--${name}`);

    return index === -1 ? undefined : args[index + 1];
}

function readDate(args: string[], name: string): Date | undefined {
    const value = readFlag(args, name);

    if (value === undefined) return undefined;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) throw new Error('Not a date: ' + value);

    return date;
}

/**
 * Parses archived responses again with the live parser and rewrites their price rows.
 * Dev: `nx run @poelens/backend:reparse -- --kind exchange`. Production: `node dist/apps/backend/src/collector/reparse.js`.
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.includes('--help')) {
        console.log(USAGE);

        return;
    }

    const collector = createCollector({ db, contact: env.COLLECTOR_CONTACT, leagues: env.COLLECTOR_LEAGUES });
    const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });

    // An idle-client error would otherwise crash the process.
    pool.on('error', () => undefined);

    try {
        // Under the scheduler's lock: a reparse interleaved with a live cycle could collide on new items and rewrite leagues.
        const result = await withCollectorLock(pool, () =>
            reparseRaw(collector.adapter, collector.store, {
                kind: readFlag(args, 'kind'),
                category: readFlag(args, 'category'),
                league: readFlag(args, 'league'),
                from: readDate(args, 'from'),
                to: readDate(args, 'to'),
            }),
        );

        if (!result.ran) {
            console.error('A collector cycle is running; try again when it has finished');
            process.exitCode = 1;

            return;
        }

        console.log(JSON.stringify(result.value, null, 2));
    } finally {
        await pool.end();
    }
}

main()
    .catch((error: unknown) => {
        console.error('Reparse failed:', error);
        process.exitCode = 1;
    })
    .finally(() => db.destroy());
