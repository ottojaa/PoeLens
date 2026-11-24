import {
    DEFAULT_UNIT,
    MAX_HISTORY_POINTS,
    NotFoundError,
    ValidationError,
    type Game,
    type HistoryBucket,
    type HistoryQuery,
    type HistoryResponse,
    type Prices,
    type Unit,
} from '@poelens/shared';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { resolveLeague } from './context.js';
import { toRowUnit } from './display-unit.js';
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

/**
 * The unit a chart reads in under Auto: the one the item's newest price reads best in, the same row the item's price
 * card shows. It is the newest row the item ever had in the league, so an item that has dropped out of its category
 * keeps its last tier instead of falling to exalted. An item with no row in the league has no tier: the default unit.
 */
async function loadAutoUnit(db: Kysely<Database>, game: Game, league: string, itemId: number): Promise<Unit> {
    const { rows } = await sql<Prices>`
        SELECT divine, exalted, chaos FROM prices
         WHERE game = ${game} AND league = ${league} AND item_id = ${itemId}
         ORDER BY time DESC
         LIMIT 1`.execute(db);
    const newest = rows[0];

    return newest ? toRowUnit('auto', newest, game) : DEFAULT_UNIT[game];
}

/** The price series of one item, bucketed by hour or day: the last price in each bucket, with its low and high. */
export async function getHistory(db: Kysely<Database>, query: HistoryQuery, now: Date = new Date()): Promise<HistoryResponse> {
    const context = await resolveLeague(db, query);
    const range = toRange(query, now);
    const item = await db
        .selectFrom('items')
        .select(['id', 'name', 'base_type', 'category', 'icon'])
        .where('id', '=', query.item)
        .where('game', '=', context.game)
        .executeTakeFirst();

    if (!item) throw new NotFoundError('Item', String(query.item));

    const choice = query.unit ?? DEFAULT_UNIT[context.game];
    const unit = choice === 'auto' ? await loadAutoUnit(db, context.game, context.league.name, item.id) : choice;
    const points = await loadBucketedPrices(db, {
        game: context.game,
        league: context.league.name,
        unit,
        bucket: query.bucket,
        itemIds: [item.id],
        from: range.from,
        to: range.to,
        includeLowConfidence: query.includeLowConfidence,
    });

    return {
        ...context,
        unit,
        item: { id: item.id, name: item.name, baseType: item.base_type, category: item.category, icon: item.icon },
        bucket: query.bucket,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        points: points.map((point) => ({ time: point.bucket.toISOString(), price: point.price, low: point.low, high: point.high })),
    };
}
