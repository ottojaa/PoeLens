import type { ItemRef, WatchlistRow, WatchlistUnlisted } from '@poelens/shared';
import { describe, expect, it } from 'vitest';
import { toRecentlyAdded } from './recent';

function item(id: number): ItemRef {
    return { id, name: `Item ${id}`, baseType: null, category: 'Currency', icon: null };
}

function row(id: number, addedAt: string): WatchlistRow {
    return {
        item: item(id),
        price: 1,
        unit: 'exalted',
        prices: { divine: 0.01, exalted: 1, chaos: 0.1 },
        asOf: addedAt,
        liquidity: null,
        lowConfidence: false,
        change: { h1: null, h24: null, d7: null },
        sparkline: [],
        addedAt,
    };
}

function unlisted(id: number, addedAt: string): WatchlistUnlisted {
    return { item: item(id), addedAt };
}

describe('toRecentlyAdded', () => {
    it('merges priced and unpriced items by when they were added, newest first', () => {
        const result = toRecentlyAdded([row(1, '2026-11-20T00:00:00Z'), row(2, '2026-11-24T00:00:00Z')], [unlisted(3, '2026-11-22T00:00:00Z')], 5);

        expect(result.map((entry) => entry.item.id)).toEqual([2, 3, 1]);
        expect(result[1]?.row).toBeUndefined();
        expect(result[0]?.row?.price).toBe(1);
    });

    it('keeps only the newest few', () => {
        const rows = [1, 2, 3, 4].map((id) => row(id, `2026-11-2${id}T00:00:00Z`));

        expect(toRecentlyAdded(rows, [], 2).map((entry) => entry.item.id)).toEqual([4, 3]);
    });

    it('is empty for an empty watchlist', () => {
        expect(toRecentlyAdded([], [], 5)).toEqual([]);
    });
});
