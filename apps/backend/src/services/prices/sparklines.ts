import type { Game, Unit } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { DAY_MS, loadBucketedPrices } from './series.js';

/** How many UTC days a sparkline covers, the day of the newest snapshot included. */
export const SPARKLINE_DAYS = 7;

export interface SparklineWindow {
    /** Inclusive: the start of the first UTC day. */
    from: Date;
    /** Exclusive: the end of the newest snapshot's UTC day. */
    to: Date;
}

/** The whole UTC days a sparkline covers: history with `bucket=day` and the same `from` returns the same points. */
export function toSparklineWindow(latest: Date): SparklineWindow {
    const dayStart = Math.floor(latest.getTime() / DAY_MS) * DAY_MS;

    return { from: new Date(dayStart - (SPARKLINE_DAYS - 1) * DAY_MS), to: new Date(dayStart + DAY_MS) };
}

export interface SparklineQuery {
    game: Game;
    league: string;
    unit: Unit;
    itemIds: number[];
    /** The fetch time of the newest snapshot the table shows. */
    latest: Date;
}

/**
 * The last week of daily closing prices for many items in one query, by item id. Low-confidence prices are left out, so
 * a day without a confident price has no point, and an item with fewer than two points has no line to draw.
 */
export async function loadSparklines(db: Kysely<Database>, query: SparklineQuery): Promise<Map<number, number[]>> {
    const { latest, ...series } = query;
    const points = await loadBucketedPrices(db, { ...series, ...toSparklineWindow(latest), bucket: 'day', includeLowConfidence: false });
    const byItem = new Map<number, number[]>();

    for (const point of points) byItem.set(point.itemId, [...(byItem.get(point.itemId) ?? []), point.price]);

    return byItem;
}
