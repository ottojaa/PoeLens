import { UNITS, type Game, type PriceRow, type Unit } from '@poelens/shared';
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
    /** The rows to draw: each item's line is in its row's unit. */
    rows: readonly PriceRow[];
    /** The fetch time of the newest snapshot the table shows. */
    latest: Date;
}

/** The ids of the rows that read in each unit: under Auto a table mixes units, a fixed unit gives one group. */
function groupByUnit(rows: readonly PriceRow[]): Map<Unit, number[]> {
    const groups = new Map<Unit, number[]>();

    for (const row of rows) groups.set(row.unit, [...(groups.get(row.unit) ?? []), row.item.id]);

    return groups;
}

/**
 * The last week of daily closing prices for many items by item id, each in its row's unit: one query per unit the rows
 * use, three at most. Low-confidence prices are left out, so a day without a confident price has no point, and an item
 * with fewer than two points has no line to draw.
 */
export async function loadSparklines(db: Kysely<Database>, query: SparklineQuery): Promise<Map<number, number[]>> {
    const { latest, rows, ...series } = query;
    const window = toSparklineWindow(latest);
    const groups = groupByUnit(rows);
    const unitSeries = await Promise.all(
        UNITS.map((unit) =>
            loadBucketedPrices(db, { ...series, ...window, unit, itemIds: groups.get(unit) ?? [], bucket: 'day', includeLowConfidence: false }),
        ),
    );
    const byItem = new Map<number, number[]>();

    for (const point of unitSeries.flat()) byItem.set(point.itemId, [...(byItem.get(point.itemId) ?? []), point.price]);

    return byItem;
}
