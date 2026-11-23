import type { ItemRef, Liquidity, PriceChange, PriceRow, Unit } from '@poelens/shared';
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Database } from '../../db/schema.js';

const UNIT_COLUMN: Record<Unit, string> = { divine: 'divine', exalted: 'exalted', chaos: 'chaos' };

const SECONDS = { h1: 3_600, h24: 86_400, d7: 604_800 } as const;

type WindowKey = keyof typeof SECONDS;

/** Rows past this many are never wanted by one view: a category holds a few hundred items at most. */
const MAX_ROWS = 5_000;

export interface RowQuery {
    unit: Unit;
    /** The snapshots (raw responses) whose rows to read. */
    rawIds: number[];
    /** Restrict to these items. */
    itemIds?: number[];
    includeLowConfidence: boolean;
}

interface RowResult {
    item_id: number;
    name: string;
    base_type: string | null;
    category: string;
    icon: string | null;
    price: number;
    time: Date;
    listings: number | null;
    volume: number | null;
    low_confidence: boolean;
    ref_h1: number | null;
    ref_h24: number | null;
    ref_d7: number | null;
}

/**
 * The same item's price about one window before this row, in the same unit: the nearest snapshot to that moment, within
 * half a window either side, ignoring low-confidence rows (a lone listing is no reference). Nothing there, no change.
 */
function referenceJoin(alias: string, window: WindowKey, column: RawBuilder<unknown>): RawBuilder<unknown> {
    const seconds = SECONDS[window];

    return sql`LEFT JOIN LATERAL (
        SELECT ref.${column} AS value
          FROM prices ref
         WHERE ref.game = p.game AND ref.league = p.league AND ref.item_id = p.item_id AND ref.source = p.source
           AND NOT ref.low_confidence
           AND ref.time BETWEEN p.time - make_interval(secs => ${seconds * 1.5}) AND p.time - make_interval(secs => ${seconds * 0.5})
         ORDER BY abs(extract(epoch FROM (p.time - make_interval(secs => ${seconds}) - ref.time)))
         LIMIT 1
    ) ${sql.id(alias)} ON true`;
}

/** Percent change from a reference price to this one, to two decimals. Null without a usable reference. */
export function toPercentChange(price: number, reference: number | null): number | null {
    if (reference === null || reference <= 0) return null;

    return Math.round((price / reference - 1) * 10_000) / 100;
}

function toLiquidity(row: Pick<RowResult, 'listings' | 'volume'>): Liquidity | null {
    if (row.listings !== null) return { kind: 'listings', value: row.listings };

    if (row.volume !== null) return { kind: 'volume', value: row.volume };

    return null;
}

function toItemRef(row: RowResult): ItemRef {
    return { id: row.item_id, name: row.name, baseType: row.base_type, category: row.category, icon: row.icon };
}

function toChange(row: RowResult): PriceChange {
    return { h1: toPercentChange(row.price, row.ref_h1), h24: toPercentChange(row.price, row.ref_h24), d7: toPercentChange(row.price, row.ref_d7) };
}

/** Rows of the given snapshots, with price in the requested unit, liquidity and change over 1h, 24h and 7d, most valuable first. */
export async function loadPriceRows(db: Kysely<Database>, query: RowQuery): Promise<PriceRow[]> {
    if (!query.rawIds.length) return [];

    const column = sql.ref(`p.${UNIT_COLUMN[query.unit]}`);
    const refColumn = sql.ref(UNIT_COLUMN[query.unit]);
    const itemFilter = query.itemIds ? sql`AND p.item_id = ANY(${query.itemIds})` : sql``;
    const confidenceFilter = query.includeLowConfidence ? sql`` : sql`AND NOT p.low_confidence`;
    const { rows } = await sql<RowResult>`
        SELECT i.id AS item_id, i.name, i.base_type, i.category, i.icon,
               ${column} AS price, p.time, p.listings, p.volume, p.low_confidence,
               h1.value AS ref_h1, h24.value AS ref_h24, d7.value AS ref_d7
          FROM prices p
          JOIN items i ON i.id = p.item_id
          ${referenceJoin('h1', 'h1', refColumn)}
          ${referenceJoin('h24', 'h24', refColumn)}
          ${referenceJoin('d7', 'd7', refColumn)}
         WHERE p.raw_id = ANY(${query.rawIds}) ${itemFilter} ${confidenceFilter}
         ORDER BY ${column} DESC, i.name
         LIMIT ${MAX_ROWS}`.execute(db);

    return rows.map((row) => ({
        item: toItemRef(row),
        price: row.price,
        asOf: row.time.toISOString(),
        liquidity: toLiquidity(row),
        lowConfidence: row.low_confidence,
        change: toChange(row),
    }));
}
