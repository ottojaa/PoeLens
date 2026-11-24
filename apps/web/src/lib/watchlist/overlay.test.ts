import { MAX_WATCHLIST_ITEMS } from '@poelens/shared';
import { describe, expect, it } from 'vitest';
import { isFullList, toWantedStates, toWatchedIds, withoutPendingRemovals } from './overlay';

const entry = (id: number) => ({ item: { id } });

describe('toWantedStates', () => {
    it('lets the latest request for an item win', () => {
        const wanted = toWantedStates([
            { itemId: 1, watched: true },
            { itemId: 2, watched: true },
            { itemId: 1, watched: false },
        ]);

        expect(wanted.get(1)).toBe(false);
        expect(wanted.get(2)).toBe(true);
    });
});

describe('toWatchedIds', () => {
    it('holds the priced and the unlisted items', () => {
        expect([...toWatchedIds([entry(1)], [entry(2)], new Map())].sort()).toEqual([1, 2]);
    });

    it('adds a pending add and drops a pending remove', () => {
        const ids = toWatchedIds(
            [entry(1), entry(2)],
            [],
            new Map([
                [3, true],
                [1, false],
            ]),
        );

        expect([...ids].sort()).toEqual([2, 3]);
    });

    it('counts an item once while its add is pending and the answer already holds it', () => {
        const ids = toWatchedIds([entry(1), entry(2)], [], new Map([[2, true]]));

        expect(ids.size).toBe(2);
    });

    it('counts a removed item once less while its removal is pending and the answer no longer holds it', () => {
        const ids = toWatchedIds([entry(1)], [], new Map([[2, false]]));

        expect(ids.size).toBe(1);
    });
});

describe('isFullList', () => {
    it('is full at the limit and not one item before', () => {
        expect(isFullList(MAX_WATCHLIST_ITEMS - 1)).toBe(false);
        expect(isFullList(MAX_WATCHLIST_ITEMS)).toBe(true);
    });

    it('is not full one item early when the add of the 99th item is pending and the answer already holds it', () => {
        const rows = Array.from({ length: MAX_WATCHLIST_ITEMS - 1 }, (_, index) => entry(index + 1));
        const size = toWatchedIds(rows, [], new Map([[MAX_WATCHLIST_ITEMS - 1, true]])).size;

        expect(size).toBe(MAX_WATCHLIST_ITEMS - 1);
        expect(isFullList(size)).toBe(false);
    });
});

describe('withoutPendingRemovals', () => {
    it('drops only the entries wanted off the list', () => {
        const kept = withoutPendingRemovals(
            [entry(1), entry(2), entry(3)],
            new Map([
                [2, false],
                [3, true],
            ]),
        );

        expect(kept.map((row) => row.item.id)).toEqual([1, 3]);
    });
});
