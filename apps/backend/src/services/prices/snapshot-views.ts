import type { LatestQuery, LatestResponse, MoversQuery, MoversResponse, PriceRow, TableQuery, TableResponse } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { resolveContext } from './context.js';
import { loadPriceRows } from './rows.js';
import { loadLatestSnapshots } from './snapshots.js';

/** One category's latest prices, most valuable first. A category with no data yet answers with no rows. */
export async function getTable(db: Kysely<Database>, query: TableQuery): Promise<TableResponse> {
    const context = await resolveContext(db, query);
    const snapshots = await loadLatestSnapshots(db, context.game, context.league.name, [query.category]);
    const rows = await loadPriceRows(db, {
        unit: context.unit,
        rawIds: snapshots.map((snapshot) => snapshot.rawId),
        times: snapshots.map((snapshot) => snapshot.time),
        includeLowConfidence: query.includeLowConfidence,
    });

    return { ...context, category: query.category, rows };
}

/** The latest price of specific items (a watchlist). Items missing from their category's newest snapshot come back as `unlisted`. */
export async function getLatest(db: Kysely<Database>, query: LatestQuery): Promise<LatestResponse> {
    const context = await resolveContext(db, query);
    const items = await db.selectFrom('items').select('category').distinct().where('game', '=', context.game).where('id', 'in', query.items).execute();
    const snapshots = await loadLatestSnapshots(
        db,
        context.game,
        context.league.name,
        items.map((item) => item.category),
    );
    const rows = await loadPriceRows(db, {
        unit: context.unit,
        rawIds: snapshots.map((snapshot) => snapshot.rawId),
        times: snapshots.map((snapshot) => snapshot.time),
        itemIds: query.items,
        includeLowConfidence: query.includeLowConfidence,
    });
    const listed = new Set(rows.map((row) => row.item.id));

    return { ...context, rows, unlisted: query.items.filter((id) => !listed.has(id)) };
}

const WINDOW_KEY = { '1h': 'h1', '24h': 'h24', '7d': 'd7' } as const;

function changeOf(row: PriceRow, window: MoversQuery['window']): number | null {
    return row.change[WINDOW_KEY[window]];
}

/** The biggest risers and fallers over a window among the latest prices, in one category or all of them. */
export async function getMovers(db: Kysely<Database>, query: MoversQuery): Promise<MoversResponse> {
    const context = await resolveContext(db, query);
    const snapshots = await loadLatestSnapshots(db, context.game, context.league.name, query.category ? [query.category] : undefined);
    const rows = await loadPriceRows(db, {
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
