import { describe, expect, it } from 'vitest';
import { PriceRowSchema, HistoryQuerySchema, LatestQuerySchema, MAX_LATEST_ITEMS, MoversQuerySchema, SearchQuerySchema, TableQuerySchema } from './prices.js';

describe('price query schemas', () => {
    it('fill the defaults a caller should never have to repeat', () => {
        const table = TableQuerySchema.parse({ game: 'poe2', category: 'Currency' });

        expect(table).toEqual({ game: 'poe2', league: 'current', category: 'Currency', includeLowConfidence: false, sparkline: false });
        expect(MoversQuerySchema.parse({ game: 'poe2' })).toMatchObject({ window: '24h', limit: 10, league: 'current' });
        expect(HistoryQuerySchema.parse({ game: 'poe2', item: '7' })).toMatchObject({ item: 7, bucket: 'hour', league: 'current' });
    });

    it('take auto as a unit on rows and history, but not on movers', () => {
        const table = TableQuerySchema.parse({ game: 'poe2', category: 'Currency', unit: 'auto' });

        expect(table.unit).toBe('auto');
        expect(LatestQuerySchema.parse({ game: 'poe2', items: '1', unit: 'auto' }).unit).toBe('auto');
        expect(HistoryQuerySchema.parse({ game: 'poe2', item: '1', unit: 'auto' }).unit).toBe('auto');
        expect(MoversQuerySchema.safeParse({ game: 'poe2', unit: 'auto' }).success).toBe(false);
        expect(MoversQuerySchema.parse({ game: 'poe2', unit: 'chaos' }).unit).toBe('chaos');
    });

    it('ask for sparklines only with a literal true', () => {
        const parse = (value: string) => TableQuerySchema.safeParse({ game: 'poe2', category: 'Currency', sparkline: value });

        expect(parse('true')).toMatchObject({ success: true, data: { sparkline: true } });
        expect(parse('false')).toMatchObject({ success: true, data: { sparkline: false } });
        expect(parse('1').success).toBe(false);
    });

    it('make the game mandatory and reject unknown values', () => {
        expect(TableQuerySchema.safeParse({ category: 'Currency' }).success).toBe(false);
        expect(TableQuerySchema.safeParse({ game: 'poe3', category: 'Currency' }).success).toBe(false);
        expect(TableQuerySchema.safeParse({ game: 'poe2', category: 'Currency', unit: 'mirror' }).success).toBe(false);
    });

    it('read includeLowConfidence as a literal true or false, never a truthy string', () => {
        const parse = (value: string) => TableQuerySchema.safeParse({ game: 'poe2', category: 'Currency', includeLowConfidence: value });

        expect(parse('true')).toMatchObject({ success: true, data: { includeLowConfidence: true } });
        expect(parse('false')).toMatchObject({ success: true, data: { includeLowConfidence: false } });
        expect(parse('yes').success).toBe(false);
    });

    it('parse the watchlist ids, deduplicate them and cap how many', () => {
        expect(LatestQuerySchema.parse({ game: 'poe2', items: '3,1,3' }).items).toEqual([3, 1]);
        expect(LatestQuerySchema.safeParse({ game: 'poe2', items: '' }).success).toBe(false);
        expect(LatestQuerySchema.safeParse({ game: 'poe2', items: 'a,b' }).success).toBe(false);

        const tooMany = Array.from({ length: MAX_LATEST_ITEMS + 1 }, (_, index) => index + 1).join(',');

        expect(LatestQuerySchema.safeParse({ game: 'poe2', items: tooMany }).success).toBe(false);
    });

    it('require a search of at least two characters', () => {
        expect(SearchQuerySchema.safeParse({ game: 'poe2', q: 'd' }).success).toBe(false);
        expect(SearchQuerySchema.parse({ game: 'poe2', q: ' divne ' }).q).toBe('divne');
    });
});

describe('PriceRowSchema', () => {
    const row = {
        item: { id: 1, name: 'Divine Orb', baseType: null, category: 'Currency', icon: null },
        price: 1,
        asOf: '2026-11-23T12:00:00.000Z',
        liquidity: null,
        lowConfidence: false,
        change: { h1: null, h24: null, d7: null },
    };

    it('carries the row unit and the price in every unit, and refuses a row without them', () => {
        const full = { ...row, unit: 'divine', prices: { divine: 1, exalted: 445.9, chaos: 13.44 } };

        expect(PriceRowSchema.parse(full)).toEqual(full);
        expect(PriceRowSchema.safeParse(row).success).toBe(false);
        expect(PriceRowSchema.safeParse({ ...full, unit: 'auto' }).success).toBe(false);
    });
});
