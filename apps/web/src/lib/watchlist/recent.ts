import type { ItemRef, WatchlistRow, WatchlistUnlisted } from '@poelens/shared';

export interface RecentItem {
    item: ItemRef;
    /** Absent for an item with no price in this league. */
    row?: WatchlistRow;
}

/** The most recently added watched items, priced ones and unpriced ones merged by when they were added. */
export function toRecentlyAdded(rows: readonly WatchlistRow[], unlisted: readonly WatchlistUnlisted[], limit: number): RecentItem[] {
    const entries = [
        ...rows.map((row) => ({ item: row.item, row, addedAt: row.addedAt })),
        ...unlisted.map(({ item, addedAt }) => ({ item, row: undefined, addedAt })),
    ];

    return entries
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
        .slice(0, limit)
        .map(({ item, row }) => ({ item, row }));
}
