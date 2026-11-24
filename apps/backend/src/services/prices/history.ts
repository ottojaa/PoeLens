import { MAX_HISTORY_POINTS, NotFoundError, ValidationError, type HistoryBucket, type HistoryQuery, type HistoryResponse } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { resolveContext } from './context.js';
import { BUCKET_MS, DAY_MS, loadBucketedPrices } from './series.js';

/** How far back a history reaches when the request names no start. */
const DEFAULT_SPAN_MS: Record<HistoryBucket, number> = { hour: 7 * DAY_MS, day: 90 * DAY_MS };

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

    const points = await loadBucketedPrices(db, {
        game: context.game,
        league: context.league.name,
        unit: context.unit,
        bucket: query.bucket,
        itemIds: [item.id],
        from: range.from,
        to: range.to,
        includeLowConfidence: query.includeLowConfidence,
    });

    return {
        ...context,
        item: { id: item.id, name: item.name, baseType: item.base_type, category: item.category, icon: item.icon },
        bucket: query.bucket,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        points: points.map((point) => ({ time: point.bucket.toISOString(), price: point.price, low: point.low, high: point.high })),
    };
}
