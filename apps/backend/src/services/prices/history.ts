import { MAX_HISTORY_POINTS, NotFoundError, ValidationError, type HistoryBucket, type HistoryQuery, type HistoryResponse, type Unit } from '@poelens/shared';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { resolveContext } from './context.js';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const BUCKET_MS: Record<HistoryBucket, number> = { hour: HOUR_MS, day: DAY_MS };

/** How far back a history reaches when the request names no start. */
const DEFAULT_SPAN_MS: Record<HistoryBucket, number> = { hour: 7 * DAY_MS, day: 90 * DAY_MS };

const UNIT_COLUMN: Record<Unit, string> = { divine: 'divine', exalted: 'exalted', chaos: 'chaos' };

interface Range {
    from: Date;
    to: Date;
}

function toRange(query: HistoryQuery, now: Date): Range {
    const to = query.to ? new Date(query.to) : now;
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_SPAN_MS[query.bucket]);

    if (from >= to) throw new ValidationError('History range is empty: from must be before to');

    const points = Math.ceil((to.getTime() - from.getTime()) / BUCKET_MS[query.bucket]);

    if (points > MAX_HISTORY_POINTS) throw new ValidationError('History range is too long for the bucket', { points, max: MAX_HISTORY_POINTS });

    return { from, to };
}

interface PointRow {
    bucket: Date;
    price: number;
    low: number;
    high: number;
}

/** The price series of one item, bucketed by hour or day: the last price in each bucket, with its low and high. */
export async function getHistory(db: Kysely<Database>, query: HistoryQuery, now: Date = new Date()): Promise<HistoryResponse> {
    const context = await resolveContext(db, query);
    const range = toRange(query, now);
    const item = await db
        .selectFrom('items')
        .select(['id', 'name', 'base_type', 'category', 'icon'])
        .where('id', '=', query.item)
        .where('game', '=', context.game)
        .executeTakeFirst();

    if (!item) throw new NotFoundError('Item', String(query.item));

    const column = sql.ref(UNIT_COLUMN[context.unit]);
    const interval = query.bucket === 'hour' ? sql`interval '1 hour'` : sql`interval '1 day'`;
    const confidenceFilter = query.includeLowConfidence ? sql`` : sql`AND NOT low_confidence`;
    const { rows } = await sql<PointRow>`
        SELECT time_bucket(${interval}, time) AS bucket, last(${column}, time) AS price, min(${column}) AS low, max(${column}) AS high
          FROM prices
         WHERE game = ${context.game} AND league = ${context.league.name} AND item_id = ${item.id}
           AND time >= ${range.from} AND time < ${range.to} ${confidenceFilter}
         GROUP BY bucket
         ORDER BY bucket`.execute(db);

    return {
        ...context,
        item: { id: item.id, name: item.name, baseType: item.base_type, category: item.category, icon: item.icon },
        bucket: query.bucket,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        points: rows.map((row) => ({ time: row.bucket.toISOString(), price: row.price, low: row.low, high: row.high })),
    };
}
