import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';

export const HOUR = 3_600_000;

/** The `time` the fixture cycle runs at: 23 Nov 2026, 12:00 UTC. */
export const T = Date.UTC(2026, 10, 23, 12, 0, 0);

export interface EarlierPrice {
    /** The earlier price is the current one divided by this, in divine; 2 means the item has doubled since. */
    divineFactor: number;
    /** Like `divineFactor`, in exalted; omitted means the exalted rate has not moved. */
    exaltedFactor?: number;
    lowConfidence?: boolean;
}

/** An older archived response for earlier points to belong to, so they are history and never part of the latest snapshot. */
export async function insertEarlierRaw(db: Kysely<Database>, category = 'Currency'): Promise<number> {
    const row = await db
        .insertInto('raw_responses')
        .values({
            source: 'poe.ninja',
            game: 'poe2',
            kind: 'exchange',
            league: 'Forbidden Rites',
            category,
            url: 'https://example.test/' + category,
            fetched_at: new Date(T - 30 * 24 * HOUR),
            status: 200,
            etag: null,
            sha256: 'earlier-' + category,
            body: Buffer.alloc(0),
            parser_version: 1,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

    return row.id;
}

/** The id of an item by name (and category). */
export async function loadItemId(db: Kysely<Database>, name: string, category = 'Currency'): Promise<number> {
    const row = await db.selectFrom('items').select('id').where('name', '=', name).where('category', '=', category).executeTakeFirstOrThrow();

    return row.id;
}

/**
 * Adds a price of an item `hoursAgo` before the fixture cycle, derived from its current price so the test names the change
 * it wants ("doubled since") and not the absolute numbers.
 */
export async function insertEarlierPrice(db: Kysely<Database>, rawId: number, itemId: number, hoursAgo: number, price: EarlierPrice): Promise<void> {
    const current = await db
        .selectFrom('prices')
        .selectAll()
        .where('item_id', '=', itemId)
        .where('time', '=', new Date(T))
        .executeTakeFirstOrThrow();

    await db
        .insertInto('prices')
        .values({
            time: new Date(T - hoursAgo * HOUR),
            game: 'poe2',
            league: 'Forbidden Rites',
            item_id: itemId,
            source: 'poe.ninja',
            divine: current.divine / price.divineFactor,
            exalted: current.exalted / (price.exaltedFactor ?? price.divineFactor),
            chaos: current.chaos / price.divineFactor,
            listings: current.listings,
            volume: current.volume,
            low_confidence: price.lowConfidence ?? false,
            raw_id: rawId,
        })
        .execute();
}
