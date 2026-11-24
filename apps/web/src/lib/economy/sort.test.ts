import type { TableRow } from '@poelens/shared';
import { describe, expect, it } from 'vitest';
import { filterRows, sortRows } from './sort';

function row(
    name: string,
    overrides: Partial<Pick<TableRow, 'price' | 'unit' | 'liquidity' | 'sparkline'>> & { divine?: number; d7?: number | null; baseType?: string | null } = {},
): TableRow {
    return {
        item: { id: name.length * 1000 + name.charCodeAt(0), name, baseType: overrides.baseType ?? null, category: 'Currency', icon: null },
        price: overrides.price ?? 1,
        unit: overrides.unit ?? 'divine',
        prices: { divine: overrides.divine ?? overrides.price ?? 1, exalted: 0, chaos: 0 },
        asOf: '2026-11-24T00:00:00.000Z',
        liquidity: overrides.liquidity ?? null,
        lowConfidence: false,
        change: { h1: null, h24: null, d7: overrides.d7 ?? null },
        sparkline: overrides.sparkline,
    };
}

const names = (rows: readonly TableRow[]) => rows.map((candidate) => candidate.item.name);

describe('sortRows', () => {
    const rows = [row('Alpha', { d7: 5 }), row('Bravo', { d7: null }), row('Charlie', { d7: -3 }), row('Delta', { d7: 12 })];

    it('puts rows without a value last when sorting descending', () => {
        expect(names(sortRows(rows, 'd7', 'desc'))).toEqual(['Delta', 'Alpha', 'Charlie', 'Bravo']);
    });

    it('puts rows without a value last when sorting ascending too', () => {
        expect(names(sortRows(rows, 'd7', 'asc'))).toEqual(['Charlie', 'Alpha', 'Delta', 'Bravo']);
    });

    it('breaks ties alphabetically', () => {
        const tied = [row('Zed', { price: 2 }), row('Ann', { price: 2 }), row('Mid', { price: 9 })];

        expect(names(sortRows(tied, 'price', 'desc'))).toEqual(['Mid', 'Ann', 'Zed']);
    });

    it('sorts price by the real value, not the number shown: 2 div above 12 c above 20 ex', () => {
        const mixed = [
            row('Cheap', { price: 20, unit: 'exalted', divine: 0.04 }),
            row('Mid', { price: 12, unit: 'chaos', divine: 0.9 }),
            row('Dear', { price: 2, unit: 'divine', divine: 2 }),
        ];

        expect(names(sortRows(mixed, 'price', 'desc'))).toEqual(['Dear', 'Mid', 'Cheap']);
        expect(names(sortRows(mixed, 'price', 'asc'))).toEqual(['Cheap', 'Mid', 'Dear']);
    });

    it('sorts liquidity with null last in both directions', () => {
        const items = [row('A', { liquidity: { kind: 'volume', value: 3 } }), row('B'), row('C', { liquidity: { kind: 'volume', value: 9 } })];

        expect(names(sortRows(items, 'liquidity', 'desc'))).toEqual(['C', 'A', 'B']);
        expect(names(sortRows(items, 'liquidity', 'asc'))).toEqual(['A', 'C', 'B']);
    });

    it('sorts the trend column by the sparkline net change, rows without a line last', () => {
        const items = [row('Up', { sparkline: [1, 2] }), row('Short', { sparkline: [1] }), row('Down', { sparkline: [2, 1] })];

        expect(names(sortRows(items, 'trend', 'desc'))).toEqual(['Up', 'Down', 'Short']);
        expect(names(sortRows(items, 'trend', 'asc'))).toEqual(['Down', 'Up', 'Short']);
    });

    it('does not change the rows it was given', () => {
        const before = names(rows);

        sortRows(rows, 'price', 'asc');

        expect(names(rows)).toEqual(before);
    });
});

describe('filterRows', () => {
    const rows = [
        row('Divine Orb', { liquidity: { kind: 'volume', value: 100 } }),
        row('Chaos Orb', { liquidity: { kind: 'volume', value: 5 } }),
        row('Thin', { baseType: 'Orb of nothing' }),
    ];

    it('keeps rows at or above the minimum liquidity, and drops those with none', () => {
        expect(names(filterRows(rows, '', 50))).toEqual(['Divine Orb']);
        expect(names(filterRows(rows, '', 5))).toEqual(['Divine Orb', 'Chaos Orb']);
    });

    it('matches text against the name or base type, ignoring case', () => {
        expect(names(filterRows(rows, 'DIVINE', 0))).toEqual(['Divine Orb']);
        expect(names(filterRows(rows, 'nothing', 0))).toEqual(['Thin']);
    });
});
