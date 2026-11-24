import type { PriceRow } from '@poelens/shared';
import { describe, expect, it } from 'vitest';
import { formatRates, toRates } from './rates';

function row(name: string, prices: PriceRow['prices']): PriceRow {
    return {
        item: { id: 1, name, baseType: null, category: 'Currency', icon: null },
        price: prices.exalted,
        unit: 'exalted',
        prices,
        asOf: '2026-01-01T00:00:00.000Z',
        liquidity: null,
        lowConfidence: false,
        change: { h1: null, h24: null, d7: null },
    };
}

describe('toRates', () => {
    it('reads the exchange rates from the Divine Orb row', () => {
        const rows = [row('Chaos Orb', { divine: 0.0744, exalted: 33.4, chaos: 1 }), row('Divine Orb', { divine: 1, exalted: 479.9, chaos: 14.63 })];

        expect(toRates(rows)).toEqual({ divine: 1, exalted: 479.9, chaos: 14.63 });
    });

    it('is undefined until the table has loaded and lists the Divine Orb', () => {
        expect(toRates(undefined)).toBeUndefined();
        expect(toRates([row('Chaos Orb', { divine: 0.0744, exalted: 33.4, chaos: 1 })])).toBeUndefined();
    });
});

describe('formatRates', () => {
    it('writes the rates as the design does', () => {
        expect(formatRates({ divine: 1, exalted: 450.2, chaos: 13.42 })).toBe('1 div = 450.2 ex = 13.42 c');
    });
});
