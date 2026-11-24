/** The table columns the viewer can hide. The item and price columns are always there. */
export const OPTIONAL_COLUMNS = ['h1', 'h24', 'd7', 'trend', 'liquidity'] as const;

export type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

/** What a fresh visit shows: every optional column but the 1 hour change. */
export const DEFAULT_COLUMNS: readonly OptionalColumn[] = ['h24', 'd7', 'trend', 'liquidity'];

export const COLUMN_LABELS: Record<OptionalColumn, string> = {
    h1: '1 hour',
    h24: '24 hours',
    d7: '7 days',
    trend: 'Trend',
    liquidity: 'Liquidity',
};

/** The columns the table can be sorted by. `trend` sorts by the sparkline's net change over its week. */
export const SORT_KEYS = ['name', 'price', 'h1', 'h24', 'd7', 'trend', 'liquidity'] as const;

export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = 'asc' | 'desc';

export const DEFAULT_SORT: { sort: SortKey; dir: SortDirection } = { sort: 'price', dir: 'desc' };
