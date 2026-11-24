import {
    CATEGORIES,
    toScopeLabel,
    type ChartBlock,
    type ChartBlockData,
    type Game,
    type HistoryRange,
    type ItemBlock,
    type ItemBlockData,
    type MoversBlock,
    type MoverWindow,
    type PairBlock,
    type PairBlockData,
    type PriceChange,
    type ScreenerBlock,
    type SortKey,
    type TableBlock,
    type Unit,
} from '@poelens/shared';
import { formatCount } from '@/lib/format';

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

/** What a sort key is called in a table's title and header: the economy page's own words. */
export const SORT_LABEL: Record<SortKey, string> = {
    name: 'name',
    price: 'price',
    h1: '1 hour',
    h24: '24 hours',
    d7: '7 days',
    trend: 'trend',
    liquidity: 'liquidity',
};

const MOVER_WINDOW_LABEL: Record<MoverWindow, string> = { '1h': '1 h', '24h': '24 h', '7d': '7 days' };

const RANGE_LABEL: Record<HistoryRange, string> = { '24h': '24 hours', '7d': '7 days', '30d': '30 days', league: 'this league' };

/** Which of a row's three changes a movers window ranks by. */
export const MOVER_CHANGE_KEY = { '1h': 'h1', '24h': 'h24', '7d': 'd7' } as const satisfies Record<MoverWindow, keyof PriceChange>;

/** The line above a table: its category, the liquidity floor if any, and what it is sorted by. The block's own name replaces it. */
export function toTableTitle(game: Game, block: Pick<TableBlock, 'name' | 'category' | 'minLiquidity' | 'sort'>): string {
    if (block.name) return block.name;

    const category = CATEGORIES[game].find((candidate) => candidate.id === block.category);
    const floor =
        block.minLiquidity > 0 ? ' · ' + formatCount(block.minLiquidity) + '+ ' + (category?.endpoint === 'exchange' ? 'div traded' : 'listings') : '';

    return (category?.label ?? block.category) + floor + ' · by ' + SORT_LABEL[block.sort];
}

/** The line above a movers block: "Movers · all uniques · 24 h". */
export function toMoversTitle(game: Game, block: Pick<MoversBlock, 'name' | 'scope' | 'window'>): string {
    return block.name || 'Movers · ' + toScopeLabel(game, block.scope) + ' · ' + MOVER_WINDOW_LABEL[block.window];
}

/** A screener's rule as the chips under its title: "+20% in 3 h", "50+ listings", "1+ div". A chip is left out when its limit is off. */
export function toScreenerRule(block: Pick<ScreenerBlock, 'direction' | 'minChangePct' | 'windowHours' | 'minLiquidity' | 'minDivine'>): string[] {
    const sign = block.direction === 'up' ? '+' : '−';

    return [
        sign + formatNumber(block.minChangePct) + '% in ' + block.windowHours + ' h',
        ...(block.minLiquidity > 0 ? [formatNumber(block.minLiquidity) + '+ listings'] : []),
        ...(block.minDivine !== null && block.minDivine > 0 ? [formatNumber(block.minDivine) + '+ div'] : []),
    ];
}

/** The title of a chart: "Original Sin · 7 days", or "A / B · 7 days" for a pair. */
export function toChartTitle(block: Pick<ChartBlock, 'name' | 'range'>, data: Pick<ChartBlockData, 'item' | 'quote'> | undefined): string {
    const subject = block.name || (data ? data.item.name + (data.quote ? ' / ' + data.quote.name : '') : 'Chart');

    return subject + ' · ' + RANGE_LABEL[block.range];
}

function formatNumber(value: number): string {
    return String(Math.round(value * 100) / 100);
}
