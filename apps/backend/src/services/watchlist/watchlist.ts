import {
    MAX_WATCHLIST_ITEMS,
    NotFoundError,
    UnauthorizedError,
    WatchlistFullError,
    type ItemRef,
    type WatchlistQuery,
    type WatchlistResponse,
} from '@poelens/shared';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { getItemRows } from '../prices/index.js';

interface WatchedItem {
    item: ItemRef;
    addedAt: Date;
}

/** The user's watched items of one game, newest first. The game comes from the item: an entry is an item, not an item in a league. */
async function loadWatchedItems(db: Kysely<Database>, userId: string, game: WatchlistQuery['game']): Promise<WatchedItem[]> {
    const rows = await db
        .selectFrom('watchlist_items as w')
        .innerJoin('items as i', 'i.id', 'w.item_id')
        .select(['i.id', 'i.name', 'i.base_type', 'i.category', 'i.icon', 'w.created_at'])
        .where('w.user_id', '=', userId)
        .where('i.game', '=', game)
        .orderBy('w.created_at', 'desc')
        .orderBy('i.name')
        .execute();

    return rows.map((row) => ({
        item: { id: row.id, name: row.name, baseType: row.base_type, category: row.category, icon: row.icon },
        addedAt: row.created_at,
    }));
}

/**
 * A user's watched items priced in a league and unit, each with its sparkline (low-confidence prices are included and
 * flagged: they chose to watch the item). Watched items with no price in the league come back as `unlisted`.
 */
export async function getWatchlist(db: Kysely<Database>, userId: string, query: WatchlistQuery): Promise<WatchlistResponse> {
    const watched = await loadWatchedItems(db, userId, query.game);
    const { context, rows, unlistedIds } = await getItemRows(db, {
        game: query.game,
        league: query.league,
        ...(query.unit && { unit: query.unit }),
        itemIds: watched.map((entry) => entry.item.id),
        includeLowConfidence: true,
        sparkline: true,
    });
    const addedAt = new Map(watched.map((entry) => [entry.item.id, entry.addedAt.toISOString()]));
    const unlisted = new Set(unlistedIds);
    const watchedRows = rows.flatMap((row) => {
        const added = addedAt.get(row.item.id);

        return added ? [{ ...row, addedAt: added, sparkline: row.sparkline ?? [] }] : [];
    });

    return {
        game: context.game,
        league: context.league,
        unit: context.unit,
        rows: watchedRows,
        unlisted: watched.filter((entry) => unlisted.has(entry.item.id)).map((entry) => ({ item: entry.item, addedAt: entry.addedAt.toISOString() })),
    };
}

/**
 * Adds an item to the user's watchlist. Adding a watched item changes nothing, even on a full list. The user's row is
 * locked for the transaction, so two adds at the limit cannot both count 99 and both insert.
 */
export async function watchItem(db: Kysely<Database>, userId: string, itemId: number): Promise<void> {
    await db.transaction().execute(async (trx) => {
        const user = await sql<{ id: string }>`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`.execute(trx);

        if (!user.rows.length) throw new UnauthorizedError('Sign in to continue', 'TOKEN_INVALID');

        const item = await trx.selectFrom('items').select('id').where('id', '=', itemId).executeTakeFirst();

        if (!item) throw new NotFoundError('Item', String(itemId));

        const existing = await trx
            .selectFrom('watchlist_items')
            .select('item_id')
            .where('user_id', '=', userId)
            .where('item_id', '=', itemId)
            .executeTakeFirst();

        if (existing) return;

        const { count } = await trx
            .selectFrom('watchlist_items')
            .select((eb) => eb.fn.countAll<string>().as('count'))
            .where('user_id', '=', userId)
            .executeTakeFirstOrThrow();

        if (Number(count) >= MAX_WATCHLIST_ITEMS) throw new WatchlistFullError(MAX_WATCHLIST_ITEMS);

        await trx.insertInto('watchlist_items').values({ user_id: userId, item_id: itemId }).execute();
    });
}

/** Removes an item from the user's watchlist. An item that is not watched (or does not exist) is already gone. */
export async function unwatchItem(db: Kysely<Database>, userId: string, itemId: number): Promise<void> {
    await db.deleteFrom('watchlist_items').where('user_id', '=', userId).where('item_id', '=', itemId).execute();
}

/** How many items the user watches, across games: the number the limit counts. */
export async function countWatchedItems(db: Kysely<Database>, userId: string): Promise<number> {
    const { count } = await db
        .selectFrom('watchlist_items')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('user_id', '=', userId)
        .executeTakeFirstOrThrow();

    return Number(count);
}
