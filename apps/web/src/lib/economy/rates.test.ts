import type { PriceRow } from '@poelens/shared';
import { describe, expect, it } from 'vitest';
import { formatRates, toRates } from './rates';

function row(name: string, price: number): PriceRow {
    return {
        item: { id: 1, name, baseType: null, category: 'Currency', icon: null },
        price,
        asOf: '2026-01-01T00:00:00.000Z',
        liquidity: null,
        lowConfidence: false,
        change: { h1: null, h24: null, d7: null },
    };
}

describe('toRates', () => {
    it('reads the Divine Orb price from the exalted and the chaos table', () => {
        const inExalted = [row('Exalted Orb', 1.0001), row('Divine Orb', 479.9)];
        const inChaos = [row('Chaos Orb', 1), row('Divine Orb', 14.63)];

        expect(toRates(inExalted, inChaos)).toEqual({ exalted: 479.9, chaos: 14.63 });
    });

    it('is undefined until both tables have the Divine Orb', () => {
        expect(toRates([row('Divine Orb', 479.9)], undefined)).toBeUndefined();
        expect(toRates([row('Divine Orb', 479.9)], [row('Chaos Orb', 1)])).toBeUndefined();
    });
});

describe('formatRates', () => {
    it('writes the rates as the design does', () => {
        expect(formatRates({ exalted: 450.2, chaos: 13.42 })).toBe('1 div = 450.2 ex = 13.42 c');
    });
});
