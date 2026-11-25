import { ValidationError, findUnknownCategories, type Game, type Panel } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';

/** The ids of items the blocks point at: an item block's, a pair's two and a chart's item and quote. */
function toItemIds(panels: readonly Panel[]): Set<number> {
    const ids = new Set<number>();

    for (const block of panels.flatMap((panel) => panel.blocks)) {
        if (block.type === 'item') ids.add(block.item);

        if (block.type === 'pair') [block.a, block.b].forEach((id) => ids.add(id));

        if (block.type === 'chart') [block.item, block.quote].forEach((id) => id !== null && ids.add(id));
    }

    return ids;
}

/** The category ids blocks name that the game does not have: a table's category and a scope's list. */
function findUnknownCategoryIds(game: Game, panels: readonly Panel[]): string[] {
    const unknown = panels
        .flatMap((panel) => panel.blocks)
        .flatMap((block) => {
            if (block.type === 'table') return findUnknownCategories(game, { categories: [block.category] });

            if (block.type === 'movers' || block.type === 'screener') return findUnknownCategories(game, block.scope);

            return [];
        });

    return [...new Set(unknown)];
}

/** Refuses blocks that point at items or categories the game does not have. */
export async function assertPanelsKnown(db: Kysely<Database>, game: Game, panels: readonly Panel[]): Promise<void> {
    const wanted = [...toItemIds(panels)];
    const known = wanted.length ? await db.selectFrom('items').select('id').where('game', '=', game).where('id', 'in', wanted).execute() : [];
    const knownIds = new Set(known.map((item) => item.id));
    const unknownItems = wanted.filter((id) => !knownIds.has(id));

    if (unknownItems.length) throw new ValidationError('Unknown items for this game', { itemIds: unknownItems });

    const unknownCategories = findUnknownCategoryIds(game, panels);

    if (unknownCategories.length) throw new ValidationError('Unknown categories for this game', { categories: unknownCategories });
}
