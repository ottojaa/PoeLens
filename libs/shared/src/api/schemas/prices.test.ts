import { describe, expect, it } from 'vitest';
import { HistoryQuerySchema, LatestQuerySchema, MAX_LATEST_ITEMS, MoversQuerySchema, SearchQuerySchema, TableQuerySchema } from './prices.js';

describe('price query schemas', () => {
    it('fill the defaults a caller should never have to repeat', () => {
        const table = TableQuerySchema.parse({ game: 'poe2', category: 'Currency' });

        expect(table).toEqual({ game: 'poe2', league: 'current', category: 'Currency', includeLowConfidence: false, sparkline: false });
        expect(MoversQuerySchema.parse({ game: 'poe2' })).toMatchObject({ window: '24h', limit: 10, league: 'current' });
        expect(HistoryQuerySchema.parse({ game: 'poe2', item: '7' })).toMatchObject({ item: 7, bucket: 'hour', league: 'current' });
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
