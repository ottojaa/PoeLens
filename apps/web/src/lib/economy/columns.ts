import type { Category } from '@poelens/shared';

// The column and sort keys live in shared, where the dashboards' table block reads them too.
export {
    COLUMN_LABELS,
    DEFAULT_COLUMNS,
    DEFAULT_SORT,
    OPTIONAL_COLUMNS,
    SORT_KEYS,
    type OptionalColumn,
    type SortDirection,
    type SortKey,
} from '@poelens/shared';

/** A category's own label for what its liquidity column counts: stash items have listings, exchange items a traded value in divine. */
export function toLiquidityLabel(category: Category): string {
    return category.endpoint === 'stash' ? 'Listings' : 'Traded (div)';
}
