import type { Game, ItemRef } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';

/** The catalog entries of these items in a game, by id. An id that is not the game's item is left out. */
export async function loadItemRefs(db: Kysely<Database>, game: Game, itemIds: readonly number[]): Promise<Map<number, ItemRef>> {
    if (!itemIds.length) return new Map();

    const rows = await db
        .selectFrom('items')
        .select(['id', 'name', 'base_type', 'category', 'icon'])
        .where('game', '=', game)
        .where('id', 'in', [...itemIds])
        .execute();

    return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name, baseType: row.base_type, category: row.category, icon: row.icon }]));
}
