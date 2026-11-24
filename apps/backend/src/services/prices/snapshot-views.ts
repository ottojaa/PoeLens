import {
    DEFAULT_UNIT,
    type LatestQuery,
    type LatestResponse,
    type MoversQuery,
    type MoversResponse,
    type PriceRow,
    type TableQuery,
    type TableResponse,
} from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { resolveContext, resolveLeague } from './context.js';
import { getItemRows } from './item-rows.js';
import { loadPriceRows } from './rows.js';
import { loadLatestSnapshots } from './snapshots.js';
import { loadSparklines } from './sparklines.js';

/**
 * One category's latest prices, most valuable first. A category with no data yet answers with no rows. With
 * `sparkline`, each row also carries its last week of daily prices in the row's unit (fewer than two points when it has no history yet).
 */
export async function getTable(db: Kysely<Database>, query: TableQuery): Promise<TableResponse> {
    const context = await resolveContext(db, query);
    const snapshots = await loadLatestSnapshots(db, context.game, context.league.name, [query.category]);
    const rows = await loadPriceRows(db, {
        game: context.game,
        unit: context.unit,
        rawIds: snapshots.map((snapshot) => snapshot.rawId),
        times: snapshots.map((snapshot) => snapshot.time),
        includeLowConfidence: query.includeLowConfidence,
    });
    const latest = snapshots[0]?.time;

    if (!query.sparkline || !latest) return { ...context, category: query.category, rows };

    const sparklines = await loadSparklines(db, { game: context.game, league: context.league.name, rows, latest });

    return { ...context, category: query.category, rows: rows.map((row) => ({ ...row, sparkline: sparklines.get(row.item.id) ?? [] })) };
}

/** The latest price of specific items. Items missing from their category's newest snapshot come back as `unlisted`. */
export async function getLatest(db: Kysely<Database>, query: LatestQuery): Promise<LatestResponse> {
    const { context, rows, unlistedIds } = await getItemRows(db, {
        game: query.game,
        league: query.league,
        ...(query.unit && { unit: query.unit }),
        itemIds: query.items,
        includeLowConfidence: query.includeLowConfidence,
        sparkline: false,
    });

    return { ...context, rows, unlisted: unlistedIds };
}

const WINDOW_KEY = { '1h': 'h1', '24h': 'h24', '7d': 'd7' } as const;

function changeOf(row: PriceRow, window: MoversQuery['window']): number | null {
    return row.change[WINDOW_KEY[window]];
}

export interface MoversInQuery {
    game: MoversQuery['game'];
    league: string;
    /** Only these categories; every category of the league when left out. */
    categories?: string[];
    window: MoversQuery['window'];
    /** A fixed unit: changes measured in different units would not rank against each other. */
    unit?: MoversQuery['unit'];
    limit: number;
    includeLowConfidence: boolean;
}

/** The biggest risers and fallers over a window among the latest prices of some categories (or all of them). */
export async function getMoversIn(db: Kysely<Database>, query: MoversInQuery): Promise<MoversResponse> {
    const context = { ...(await resolveLeague(db, query)), unit: query.unit ?? DEFAULT_UNIT[query.game] };
    const snapshots = await loadLatestSnapshots(db, context.game, context.league.name, query.categories);
    const rows = await loadPriceRows(db, {
        game: context.game,
        unit: context.unit,
        rawIds: snapshots.map((snapshot) => snapshot.rawId),
        times: snapshots.map((snapshot) => snapshot.time),
        includeLowConfidence: query.includeLowConfidence,
    });
    const moved = rows
        .map((row) => ({ row, change: changeOf(row, query.window) }))
        .filter((entry): entry is { row: PriceRow; change: number } => entry.change !== null);
    const risers = moved.filter((entry) => entry.change > 0).sort((a, b) => b.change - a.change);
    const fallers = moved.filter((entry) => entry.change < 0).sort((a, b) => a.change - b.change);

    return {
        ...context,
        window: query.window,
        risers: risers.slice(0, query.limit).map((entry) => entry.row),
        fallers: fallers.slice(0, query.limit).map((entry) => entry.row),
    };
}

/** The biggest risers and fallers over a window among the latest prices, in one category or all of them. */
export function getMovers(db: Kysely<Database>, query: MoversQuery): Promise<MoversResponse> {
    const { category, ...rest } = query;

    return getMoversIn(db, { ...rest, ...(category && { categories: [category] }) });
}
