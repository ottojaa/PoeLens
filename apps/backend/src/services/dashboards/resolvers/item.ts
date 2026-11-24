import type { BlockData } from '@poelens/shared';
import { groupBy } from '../group-by.js';
import { getItemRows } from '../../prices/index.js';
import { loadItemRefs } from '../../prices/item-refs.js';
import type { Resolver } from './types.js';

/**
 * Item blocks: one price query per unit the blocks read in. Low-confidence prices are included (flagged on the row),
 * since the user picked the item. An item with no price in the league is answered with the item and no row.
 */
export const resolveItems: Resolver<'item'> = async (db, context, entries) => {
    const byUnit = groupBy(entries, (entry) => entry.unit);
    const refs = await loadItemRefs(
        db,
        context.game,
        entries.map((entry) => entry.block.item),
    );
    const answers = new Map<string, BlockData | null>();

    await Promise.all(
        [...byUnit].map(async ([unit, group]) => {
            const { rows } = await getItemRows(db, {
                ...context,
                unit,
                itemIds: group.map((entry) => entry.block.item),
                includeLowConfidence: true,
                sparkline: true,
            });
            const rowByItem = new Map(rows.map((row) => [row.item.id, row]));

            for (const { block } of group) {
                const item = refs.get(block.item);

                answers.set(block.id, item ? { type: 'item', item, row: rowByItem.get(block.item) ?? null } : null);
            }
        }),
    );

    return answers;
};
