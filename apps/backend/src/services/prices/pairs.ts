import type { Game, ItemRef } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { getItemRows } from './item-rows.js';
import { loadItemRefs } from './item-refs.js';
import { DAY_MS, loadBucketedPrices } from './series.js';
import { toSparklineWindow } from './sparklines.js';

export interface PairQuery {
    game: Game;
    /** A league name, or `'current'`. */
    league: string;
    pairs: readonly { a: number; b: number }[];
}

/** How many `b` one `a` buys, with its change and last week. */
export interface PairRate {
    a: ItemRef;
    b: ItemRef;
    /** Null when either side has no price in the league. */
    price: number | null;
    /** Percent change over 24 hours; null without a reference price for both sides. */
    h24: number | null;
    /** Daily closes of the rate, oldest first. Days a side has no confident price for are left out. */
    sparkline: number[];
    lowConfidence: boolean;
    /** The older of the two sides' snapshots. */
    asOf: string | null;
}

const toRounded = (value: number): number => Math.round(value * 100) / 100;

/** The change of `a` priced in `b`, from each side's own change (both in percent, both measured in the same unit). */
function toRateChange(a: number | null, b: number | null): number | null {
    if (a === null || b === null || b <= -100) return null;

    return toRounded(((1 + a / 100) / (1 + b / 100) - 1) * 100);
}

/** Per bucket start, both sides' price, for the buckets they share: the rate's daily closes. */
function toRateSeries(a: ReadonlyMap<number, number> | undefined, b: ReadonlyMap<number, number> | undefined): number[] {
    if (!a || !b) return [];

    return [...a.keys()]
        .sort((x, y) => x - y)
        .flatMap((bucket) => {
            const priceB = b.get(bucket);

            return priceB && priceB > 0 ? [a.get(bucket)! / priceB] : [];
        });
}

/**
 * Pairs priced in each other, in the order asked. Every side is read in divine whatever unit the viewer reads in, since
 * a row's change is in the row's own unit and a ratio of changes only means something when both sides share one.
 */
export async function getPairs(db: Kysely<Database>, query: PairQuery): Promise<PairRate[]> {
    const itemIds = [...new Set(query.pairs.flatMap((pair) => [pair.a, pair.b]))];

    if (!itemIds.length) return [];

    const [{ context, rows }, refs] = await Promise.all([
        getItemRows(db, { game: query.game, league: query.league, unit: 'divine', itemIds, includeLowConfidence: true, sparkline: false }),
        loadItemRefs(db, query.game, itemIds),
    ]);
    const byItem = new Map(rows.map((row) => [row.item.id, row]));
    const latest = new Date(Math.max(0, ...rows.map((row) => Date.parse(row.asOf))));
    const closes = await loadBucketedPrices(db, {
        game: query.game,
        league: context.league.name,
        unit: 'divine',
        bucket: 'day',
        itemIds,
        ...toSparklineWindow(latest),
        includeLowConfidence: false,
    });
    const closesByItem = new Map<number, Map<number, number>>();

    for (const point of closes) {
        const days = closesByItem.get(point.itemId) ?? new Map<number, number>();

        days.set(Math.floor(point.bucket.getTime() / DAY_MS), point.price);
        closesByItem.set(point.itemId, days);
    }

    return query.pairs.flatMap((pair) => {
        const a = refs.get(pair.a);
        const b = refs.get(pair.b);

        if (!a || !b) return [];

        const rowA = byItem.get(pair.a);
        const rowB = byItem.get(pair.b);
        const priced = rowA && rowB && rowB.prices.divine > 0;
        const asOf = rowA && rowB ? new Date(Math.min(Date.parse(rowA.asOf), Date.parse(rowB.asOf))).toISOString() : null;

        return [
            {
                a,
                b,
                price: priced ? rowA.prices.divine / rowB.prices.divine : null,
                h24: priced ? toRateChange(rowA.change.h24, rowB.change.h24) : null,
                sparkline: toRateSeries(closesByItem.get(pair.a), closesByItem.get(pair.b)),
                lowConfidence: Boolean(rowA?.lowConfidence || rowB?.lowConfidence),
                asOf,
            },
        ];
    });
}
