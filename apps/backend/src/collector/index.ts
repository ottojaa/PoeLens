import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import { API_VERSION } from '../config/version.js';
import { createFetcher, type Fetcher } from './http.js';
import { runCycle } from './runtime.js';
import { createPoeNinjaPoe2Adapter } from './sources/poe-ninja/poe2.js';
import type { CollectorStore, RunSummary } from './store.js';
import { createPgCollectorStore } from './store-pg.js';
import type { SourceAdapter } from './types.js';

export interface Collector {
    adapter: SourceAdapter;
    store: CollectorStore;
    fetcher: Fetcher;
    /** One full cycle. Does not take the collector lock: the scheduler and `collect.ts` do. */
    runCycle(signal?: AbortSignal): Promise<RunSummary>;
}

/** Says who is polling and how to reach them, as poe.ninja's API terms ask. */
export function toUserAgent(contact: string): string {
    return `PoeLens/${API_VERSION} (+${contact})`;
}

export interface CollectorOptions {
    db: Kysely<Database>;
    contact: string;
    leagues: string[];
}

export function createCollector(options: CollectorOptions): Collector {
    const adapter = createPoeNinjaPoe2Adapter({ leagues: options.leagues });
    const store = createPgCollectorStore(options.db);
    const fetcher = createFetcher({ userAgent: toUserAgent(options.contact) });

    return { adapter, store, fetcher, runCycle: (signal) => runCycle({ adapter, store, fetcher, signal }) };
}
