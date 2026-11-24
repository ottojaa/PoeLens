import type { TableRow } from '@poelens/shared';
import { toTrendChange } from './sparkline';
import type { SortDirection, SortKey } from './columns';

function toSortValue(row: TableRow, key: SortKey): number | string | null {
    switch (key) {
        case 'name':
            return row.item.name;
        case 'price':
            // Rows can be in different units under Auto, so the number shown is not comparable: sort by the row's real value.
            return row.prices.divine;
        case 'h1':
            return row.change.h1;
        case 'h24':
            return row.change.h24;
        case 'd7':
            return row.change.d7;
        case 'liquidity':
            return row.liquidity?.value ?? null;
        case 'trend':
            return toTrendChange(row.sparkline);
    }
}

function compareValues(a: number | string, b: number | string): number {
    if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);

    return Number(a) - Number(b);
}

/** Traded rows (a value in divine) before listing counts: the two are not comparable, so a mixed list keeps them apart. */
function toLiquidityRank(row: TableRow): number {
    return row.liquidity?.kind === 'volume' ? 0 : 1;
}

export interface SortOptions {
    /** For lists that mix categories: the liquidity column sorts by kind first, then by value. */
    liquidityByKind?: boolean;
}

/**
 * Rows ordered by a column. A row with no value (no change yet, no liquidity) goes last in both directions, so
 * flipping the sort never lifts the empty rows to the top; ties keep alphabetical order.
 */
export function sortRows<T extends TableRow>(rows: readonly T[], key: SortKey, direction: SortDirection, options: SortOptions = {}): T[] {
    const sign = direction === 'asc' ? 1 : -1;
    const byKind = key === 'liquidity' && options.liquidityByKind;

    return [...rows].sort((a, b) => {
        if (byKind && a.liquidity && b.liquidity && a.liquidity.kind !== b.liquidity.kind) return toLiquidityRank(a) - toLiquidityRank(b);

        const left = toSortValue(a, key);
        const right = toSortValue(b, key);

        if (left === null && right === null) return a.item.name.localeCompare(b.item.name);

        if (left === null) return 1;

        if (right === null) return -1;

        return sign * compareValues(left, right) || a.item.name.localeCompare(b.item.name);
    });
}

/** The table filters: a text match on name or base type, and a minimum liquidity. */
export function filterRows<T extends TableRow>(rows: readonly T[], text: string, minLiquidity: number): T[] {
    const needle = text.trim().toLowerCase();

    return rows.filter((row) => {
        if (minLiquidity > 0 && (row.liquidity?.value ?? 0) < minLiquidity) return false;

        if (!needle) return true;

        return row.item.name.toLowerCase().includes(needle) || (row.item.baseType?.toLowerCase().includes(needle) ?? false);
    });
}
