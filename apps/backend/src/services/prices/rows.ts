import { UNITS, type Game, type ItemRef, type Liquidity, type Prices, type PriceChange, type PriceRow, type Unit, type UnitChoice } from '@poelens/shared';
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Database } from '../../db/schema.js';
import { toRowUnit } from './display-unit.js';
import { UNIT_COLUMN } from './series.js';

const SECONDS = { h1: 3_600, h24: 86_400, d7: 604_800 } as const;

type WindowKey = keyof typeof SECONDS;

const WINDOWS = Object.keys(SECONDS) as WindowKey[];

/** Rows past this many are never wanted by one view: a category holds a few hundred items at most. */
const MAX_ROWS = 5_000;

export interface RowQuery {
    game: Game;
    /** A fixed unit, or `auto` to give each row the unit its price reads best in. */
    unit: UnitChoice;
    /** The snapshots (raw responses) whose rows to read. */
    rawIds: number[];
    /** The snapshots' fetch times. A price row's time is its snapshot's fetch time, so they let TimescaleDB skip every other chunk. */
    times: Date[];
    /** Restrict to these items. */
    itemIds?: number[];
    includeLowConfidence: boolean;
}

/** The reference price of each window in each unit, from the same reference row: `h1_divine`, `h1_exalted`, ... */
type ReferenceColumns = Record<`${WindowKey}_${Unit}`, number | null>;

interface RowResult extends ReferenceColumns {
    item_id: number;
    name: string;
    base_type: string | null;
    category: string;
    icon: string | null;
    divine: number;
    exalted: number;
    chaos: number;
    time: Date;
    listings: number | null;
    volume: number | null;
    low_confidence: boolean;
}

/**
 * The same item's price about one window before this row, in every unit: the nearest snapshot to that moment, within
 * half a window either side, ignoring low-confidence rows (a lone listing is no reference). Nothing there, no change.
 */
function referenceJoin(window: WindowKey): RawBuilder<unknown> {
    const seconds = SECONDS[window];
    const columns = sql.join(UNITS.map((unit) => sql.ref(`ref.${UNIT_COLUMN[unit]}`)));

    return sql`LEFT JOIN LATERAL (
        SELECT ${columns}
          FROM prices ref
         WHERE ref.game = p.game AND ref.league = p.league AND ref.item_id = p.item_id AND ref.source = p.source
           AND NOT ref.low_confidence
           AND ref.time BETWEEN p.time - make_interval(secs => ${seconds * 1.5}) AND p.time - make_interval(secs => ${seconds * 0.5})
         ORDER BY abs(extract(epoch FROM (p.time - make_interval(secs => ${seconds}) - ref.time)))
         LIMIT 1
    ) ${sql.id(window)} ON true`;
}

/** `h1.divine AS h1_divine, ...`: every window's reference price in every unit. */
function referenceSelect(): RawBuilder<unknown> {
    return sql.join(WINDOWS.flatMap((window) => UNITS.map((unit) => sql`${sql.id(window)}.${sql.id(unit)} AS ${sql.id(`${window}_${unit}`)}`)));
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

function toPrices(row: RowResult): Prices {
    return { divine: row.divine, exalted: row.exalted, chaos: row.chaos };
}

/** The change over each window in `unit`, measured against the reference row's price in that same unit. */
function toChange(row: RowResult, unit: Unit): PriceChange {
    const price = row[unit];

    return {
        h1: toPercentChange(price, row[`h1_${unit}`]),
        h24: toPercentChange(price, row[`h24_${unit}`]),
        d7: toPercentChange(price, row[`d7_${unit}`]),
    };
}

function toPriceRow(row: RowResult, choice: UnitChoice, game: Game): PriceRow {
    const prices = toPrices(row);
    const unit = toRowUnit(choice, prices, game);

    return {
        item: toItemRef(row),
        price: prices[unit],
        unit,
        prices,
        asOf: row.time.toISOString(),
        liquidity: toLiquidity(row),
        lowConfidence: row.low_confidence,
        change: toChange(row, unit),
    };
}

/**
 * Rows of the given snapshots with liquidity, and price and change over 1h, 24h and 7d in each row's unit (the
 * requested one, or under `auto` the one its price reads best in), most valuable first.
 */
export async function loadPriceRows(db: Kysely<Database>, query: RowQuery): Promise<PriceRow[]> {
    if (!query.rawIds.length) return [];

    const orderColumn = sql.ref(`p.${UNIT_COLUMN[query.unit === 'auto' ? 'divine' : query.unit]}`);
    const itemFilter = query.itemIds ? sql`AND p.item_id = ANY(${query.itemIds})` : sql``;
    const times = query.times.map((time) => time.toISOString());
    const confidenceFilter = query.includeLowConfidence ? sql`` : sql`AND NOT p.low_confidence`;
    const { rows } = await sql<RowResult>`
        SELECT i.id AS item_id, i.name, i.base_type, i.category, i.icon,
               p.divine, p.exalted, p.chaos, p.time, p.listings, p.volume, p.low_confidence,
               ${referenceSelect()}
          FROM prices p
          JOIN items i ON i.id = p.item_id
          ${sql.join(WINDOWS.map(referenceJoin), sql` `)}
         WHERE p.time = ANY(${times}::timestamptz[]) AND p.raw_id = ANY(${query.rawIds}) ${itemFilter} ${confidenceFilter}
         ORDER BY ${orderColumn} DESC, i.name
         LIMIT ${MAX_ROWS}`.execute(db);

    return rows.map((row) => toPriceRow(row, query.unit, query.game));
}
