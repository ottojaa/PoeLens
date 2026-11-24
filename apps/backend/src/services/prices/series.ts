import type { Game, HistoryBucket, Unit } from '@poelens/shared';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export const BUCKET_MS: Record<HistoryBucket, number> = { hour: HOUR_MS, day: DAY_MS };

/** The `prices` column that holds a price in each unit. */
export const UNIT_COLUMN: Record<Unit, string> = { divine: 'divine', exalted: 'exalted', chaos: 'chaos' };

export interface SeriesQuery {
    game: Game;
    league: string;
    unit: Unit;
    bucket: HistoryBucket;
    itemIds: number[];
    /** Inclusive. */
    from: Date;
    /** Exclusive. */
    to: Date;
    includeLowConfidence: boolean;
}

export interface SeriesPoint {
    itemId: number;
    /** The start of the bucket, aligned to UTC. */
    bucket: Date;
    /** The last price in the bucket. */
    price: number;
    low: number;
    high: number;
}

interface SeriesRow {
    item_id: number;
    bucket: Date;
    price: number;
    low: number;
    high: number;
}

/**
 * The one aggregation behind every price series: the last price in each UTC-aligned bucket, with its low and high,
 * for any number of items in one query, skipping low-confidence rows unless asked. History and the table's sparklines
 * both read through it, so a sparkline point is always a point the history endpoint would return.
 */
export async function loadBucketedPrices(db: Kysely<Database>, query: SeriesQuery): Promise<SeriesPoint[]> {
    if (!query.itemIds.length) return [];

    const column = sql.ref(UNIT_COLUMN[query.unit]);
    const interval = query.bucket === 'hour' ? sql`interval '1 hour'` : sql`interval '1 day'`;
    const confidenceFilter = query.includeLowConfidence ? sql`` : sql`AND NOT low_confidence`;
    const { rows } = await sql<SeriesRow>`
        SELECT item_id, time_bucket(${interval}, time) AS bucket, last(${column}, time) AS price, min(${column}) AS low, max(${column}) AS high
          FROM prices
         WHERE game = ${query.game} AND league = ${query.league} AND item_id = ANY(${query.itemIds})
           AND time >= ${query.from} AND time < ${query.to} ${confidenceFilter}
         GROUP BY item_id, bucket
         ORDER BY item_id, bucket`.execute(db);

    return rows.map((row) => ({ itemId: row.item_id, bucket: row.bucket, price: row.price, low: row.low, high: row.high }));
}
