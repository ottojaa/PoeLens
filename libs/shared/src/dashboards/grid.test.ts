import { describe, expect, it } from 'vitest';
import { type GridItem, move, normalize, nudge, overlaps, phoneOrder, place, resize, stretch } from './grid.js';

function item(id: string, x: number, y: number, w: number, h: number): GridItem {
    return { id, x, y, w, h };
}

function rects(items: readonly GridItem[]): Record<string, [number, number, number, number]> {
    return Object.fromEntries(items.map((entry) => [entry.id, [entry.x, entry.y, entry.w, entry.h]]));
}

function hasOverlap(items: readonly GridItem[]): boolean {
    return items.some((a, i) => items.slice(i + 1).some((b) => overlaps(a, b)));
}

describe('normalize', () => {
    it('leaves a valid layout alone', () => {
        const items = [item('a', 0, 0, 6, 4), item('b', 6, 0, 6, 4), item('c', 0, 4, 12, 3)];

        expect(normalize(items)).toEqual(items);
    });

    it('is idempotent', () => {
        const messy = [item('a', 3, 2, 8, 4), item('b', 5, 1, 9, 3), item('c', 0, 9, 4, 2), item('d', 2, 2, 2, 2)];
        const once = normalize(messy);

        expect(normalize(once)).toEqual(once);
    });

    it('clamps width, height and position to the 12 columns', () => {
        const [a, b] = normalize([item('a', 10, 0, 6, 4), item('b', -3, -2, 20, 0)]);

        expect(a).toMatchObject({ x: 6, w: 6 });
        expect(b).toMatchObject({ x: 0, w: 12, h: 1 });
    });

    it('rounds fractional values', () => {
        const [a] = normalize([item('a', 1.4, 0.6, 3.5, 2.2)]);

        expect(a).toMatchObject({ x: 1, w: 4, h: 2 });
    });

    it('pushes an overlapping panel below the one above it', () => {
        const result = normalize([item('a', 0, 0, 6, 4), item('b', 3, 2, 6, 4)]);

        expect(rects(result).b).toEqual([3, 4, 6, 4]);
        expect(hasOverlap(result)).toBe(false);
    });

    it('floats panels up into free space', () => {
        const result = normalize([item('a', 0, 5, 6, 3), item('b', 6, 9, 6, 2)]);

        expect(rects(result)).toEqual({ a: [0, 0, 6, 3], b: [6, 0, 6, 2] });
    });

    it('keeps the input order whatever the positions', () => {
        const result = normalize([item('late', 0, 8, 4, 2), item('early', 0, 0, 4, 2)]);

        expect(result.map((entry) => entry.id)).toEqual(['late', 'early']);
    });

    it('keeps other fields of the items', () => {
        const [a] = normalize([{ ...item('a', 0, 3, 4, 2), title: 'Currency' }]);

        expect(a).toMatchObject({ title: 'Currency', y: 0 });
    });

    it('answers an empty grid', () => {
        expect(normalize([])).toEqual([]);
    });
});

describe('place', () => {
    it('puts the first panel in the corner', () => {
        expect(place([], { w: 6, h: 4 })).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    });

    it('puts a new panel below the lowest one', () => {
        const items = [item('a', 0, 0, 6, 4), item('b', 6, 0, 6, 7)];

        expect(place(items, { w: 12, h: 3 })).toEqual({ x: 0, y: 7, w: 12, h: 3 });
    });

    it('clamps the size to the grid', () => {
        expect(place([], { w: 40, h: 0 })).toEqual({ x: 0, y: 0, w: 12, h: 1 });
    });
});

describe('move', () => {
    const items = [item('a', 0, 0, 6, 4), item('b', 6, 0, 6, 4), item('c', 0, 4, 12, 3)];

    it('swaps a panel into a taken place and the other makes room', () => {
        const result = move(items, 'b', { x: 0, y: 0 });

        expect(rects(result).b).toEqual([0, 0, 6, 4]);
        expect(rects(result).a).toEqual([0, 4, 6, 4]);
        expect(hasOverlap(result)).toBe(false);
    });

    it('lands a panel in empty space and compacts it up', () => {
        const result = move([item('a', 0, 0, 6, 4), item('b', 6, 0, 6, 4)], 'b', { x: 6, y: 20 });

        expect(rects(result).b).toEqual([6, 0, 6, 4]);
    });

    it('clamps a move past the right edge', () => {
        const result = move(items, 'a', { x: 11, y: 0 });

        expect(rects(result).a?.[0]).toBe(6);
    });

    it('ignores an unknown id', () => {
        expect(move(items, 'zzz', { x: 0, y: 0 })).toEqual(items);
    });

    it('never leaves an overlap', () => {
        for (let x = 0; x < 12; x++) {
            for (let y = 0; y < 8; y++) expect(hasOverlap(move(items, 'c', { x, y }))).toBe(false);
        }
    });
});

describe('resize', () => {
    const items = [item('a', 0, 0, 6, 4), item('b', 6, 0, 6, 4), item('c', 0, 4, 12, 3)];

    it('pushes what is in the way down', () => {
        const result = resize(items, 'a', { w: 9, h: 4 });

        expect(rects(result).a).toEqual([0, 0, 9, 4]);
        expect(rects(result).b).toEqual([6, 4, 6, 4]);
        expect(hasOverlap(result)).toBe(false);
    });

    it('keeps a panel inside the grid when it widens', () => {
        const result = resize(items, 'b', { w: 9, h: 4 });

        expect(rects(result).b).toEqual([3, 0, 9, 4]);
    });

    it('never goes below one cell', () => {
        const result = resize(items, 'a', { w: 0, h: -3 });

        expect(rects(result).a).toEqual([0, 0, 1, 1]);
    });

    it('lets the panels below float up when one shrinks', () => {
        const result = resize(items, 'a', { w: 6, h: 2 });

        expect(rects(result).c?.[1]).toBe(4);
        expect(rects(result).a).toEqual([0, 0, 6, 2]);
    });
});

describe('keyboard steps', () => {
    const items = [item('a', 0, 0, 6, 4), item('b', 6, 0, 6, 4)];

    it('nudge moves a panel by whole cells', () => {
        expect(rects(nudge([item('a', 2, 0, 4, 2)], 'a', 1, 0)).a).toEqual([3, 0, 4, 2]);
    });

    it('nudge down with nothing below floats the panel back up', () => {
        expect(rects(nudge([item('a', 0, 0, 4, 2)], 'a', 0, 1)).a).toEqual([0, 0, 4, 2]);
    });

    it('nudge down with another panel below swaps places', () => {
        const stacked = [item('a', 0, 0, 12, 2), item('b', 0, 2, 12, 2)];
        const result = nudge(stacked, 'a', 0, 3);

        expect(rects(result).b).toEqual([0, 0, 12, 2]);
        expect(rects(result).a).toEqual([0, 2, 12, 2]);
    });

    it('nudge left at the edge stays put', () => {
        expect(rects(nudge(items, 'a', -1, 0)).a).toEqual([0, 0, 6, 4]);
    });

    it('stretch grows and shrinks by cells', () => {
        expect(rects(stretch([item('a', 0, 0, 4, 2)], 'a', 2, 1)).a).toEqual([0, 0, 6, 3]);
        expect(rects(stretch([item('a', 0, 0, 4, 2)], 'a', -9, -9)).a).toEqual([0, 0, 1, 1]);
    });
});

describe('phoneOrder', () => {
    it('reads top to bottom, then left to right', () => {
        const items = [item('d', 6, 4, 6, 2), item('b', 6, 0, 6, 4), item('c', 0, 4, 6, 2), item('a', 0, 0, 6, 4)];

        expect(phoneOrder(items).map((entry) => entry.id)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('does not change the input', () => {
        const items = [item('b', 6, 0, 6, 4), item('a', 0, 0, 6, 4)];

        phoneOrder(items);

        expect(items.map((entry) => entry.id)).toEqual(['b', 'a']);
    });
});

describe('random layouts', () => {
    // A small deterministic generator, so a failure reproduces.
    function random(seed: number): () => number {
        let state = seed;

        return () => {
            state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;

            return state / 4_294_967_296;
        };
    }

    function layout(next: () => number): GridItem[] {
        const count = 1 + Math.floor(next() * 8);

        return Array.from({ length: count }, (_, index) =>
            item('p' + index, Math.floor(next() * 14) - 1, Math.floor(next() * 12), Math.floor(next() * 14), Math.floor(next() * 6)),
        );
    }

    it('normalize always gives an overlap-free, idempotent layout inside the grid', () => {
        const next = random(7);

        for (let round = 0; round < 300; round++) {
            const result = normalize(layout(next));

            expect(hasOverlap(result)).toBe(false);
            expect(result.every((entry) => entry.x >= 0 && entry.x + entry.w <= 12 && entry.y >= 0 && entry.w >= 1 && entry.h >= 1)).toBe(true);
            expect(normalize(result)).toEqual(result);
        }
    });

    it('move and resize always give an overlap-free layout and keep the sizes they were asked for', () => {
        const next = random(11);

        for (let round = 0; round < 300; round++) {
            const items = normalize(layout(next));
            const target = items[Math.floor(next() * items.length)]!;
            const moved = move(items, target.id, { x: Math.floor(next() * 12), y: Math.floor(next() * 12) });
            const resized = resize(items, target.id, { w: 1 + Math.floor(next() * 12), h: 1 + Math.floor(next() * 6) });

            expect(hasOverlap(moved)).toBe(false);
            expect(hasOverlap(resized)).toBe(false);
            expect(moved.find((entry) => entry.id === target.id)).toMatchObject({ w: target.w, h: target.h });
        }
    });
});
