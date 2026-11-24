import type { ItemBlock, ItemBlockData, PairBlock, PairBlockData, Unit } from '@poelens/shared';

/** The letter a unit's small tile shows. */
export const UNIT_LETTER: Record<Unit, string> = { divine: 'D', exalted: 'E', chaos: 'C' };

/** The name an item block shows: the one the user gave it, else the item's own. */
export function toItemName(block: Pick<ItemBlock, 'name'>, data: ItemBlockData | null | undefined): string {
    return block.name || data?.item.name || 'Item';
}

/** The name a pair block shows: the one the user gave it, else "A / B". */
export function toPairName(block: Pick<PairBlock, 'name'>, data: PairBlockData | null | undefined): string {
    if (block.name) return block.name;

    return data ? data.a.name + ' / ' + data.b.name : 'Pair';
}
