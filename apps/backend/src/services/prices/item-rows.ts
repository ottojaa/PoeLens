import type { Game, TableRow, Unit } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { resolveContext, type PriceContext } from './context.js';
import { loadPriceRows } from './rows.js';
import { loadLatestSnapshots } from './snapshots.js';
import { loadSparklines } from './sparklines.js';

export interface ItemRowsQuery {
    game: Game;
    /** A league name, or `'current'`. */
    league: string;
    unit?: Unit;
    itemIds: readonly number[];
    includeLowConfidence: boolean;
    /** Give each row its last week of daily prices (`[]` when it has none). */
    sparkline: boolean;
}

export interface ItemRows {
    context: PriceContext;
    /** Most valuable first. Only items of the game that the newest snapshot of their category lists. */
    rows: TableRow[];
    /** Asked-for ids with no row: missing from the newest snapshot of their category, unknown, other game's, or low confidence and not asked for. In the order asked. */
    unlistedIds: number[];
}

/**
 * The latest price of specific items, whatever categories they are in. This is the one place that puts a mixed set of
 * items together (the categories' newest snapshots, units, sparklines), so the `latest` route and the watchlist agree.
 */
export async function getItemRows(db: Kysely<Database>, query: ItemRowsQuery): Promise<ItemRows> {
    const context = await resolveContext(db, query);
    const itemIds = [...query.itemIds];

    if (!itemIds.length) return { context, rows: [], unlistedIds: [] };

    const categories = await db.selectFrom('items').select('category').distinct().where('game', '=', context.game).where('id', 'in', itemIds).execute();
    const snapshots = await loadLatestSnapshots(
        db,
        context.game,
        context.league.name,
        categories.map((item) => item.category),
    );
    const priced = await loadPriceRows(db, {
        unit: context.unit,
        rawIds: snapshots.map((snapshot) => snapshot.rawId),
        times: snapshots.map((snapshot) => snapshot.time),
        itemIds,
        includeLowConfidence: query.includeLowConfidence,
    });
    const listed = new Set(priced.map((row) => row.item.id));
    const unlistedIds = itemIds.filter((id) => !listed.has(id));

    if (!query.sparkline) return { context, rows: priced, unlistedIds };

    // Each category's snapshot has its own fetch time; the window must reach the newest one's day, or that category's latest price would fall outside it.
    const latest = new Date(Math.max(0, ...snapshots.map((snapshot) => snapshot.time.getTime())));
    const sparklines = await loadSparklines(db, {
        game: context.game,
        league: context.league.name,
        unit: context.unit,
        itemIds: priced.map((row) => row.item.id),
        latest,
    });

    return { context, rows: priced.map((row) => ({ ...row, sparkline: sparklines.get(row.item.id) ?? [] })), unlistedIds };
}
