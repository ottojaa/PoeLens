import { describe, expect, it } from 'vitest';
import { DEFAULT_COLUMNS } from './columns';
import { parseColumns, parseEconomySearch, parseItemSearch, parseRootSearch, toColumnsParam, toEconomyView, toRange } from './search-params';

describe('root search', () => {
    it('keeps a valid league and unit', () => {
        expect(parseRootSearch({ league: 'Forbidden Rites', unit: 'chaos' })).toEqual({ league: 'Forbidden Rites', unit: 'chaos' });
        expect(parseRootSearch({ unit: 'auto' })).toMatchObject({ unit: 'auto' });
    });

    it('drops garbage instead of throwing', () => {
        expect(parseRootSearch({ league: '', unit: 'gold' })).toEqual({ league: undefined, unit: undefined });
        expect(parseRootSearch({ league: { nested: true }, unit: 7 })).toEqual({ league: undefined, unit: undefined });
        expect(parseRootSearch({})).toEqual({});
    });
});

describe('economy search', () => {
    it('falls back to the defaults when every param is missing', () => {
        expect(toEconomyView(parseEconomySearch({}))).toEqual({ sort: 'price', dir: 'desc', q: '', min: 0, hideLow: true, columns: DEFAULT_COLUMNS });
    });

    it('falls back to the defaults on garbage', () => {
        const view = toEconomyView(parseEconomySearch({ sort: 'nonsense', dir: 'sideways', min: 'abc', hideLow: 'maybe', cols: 7 }));

        expect(view).toEqual({ sort: 'price', dir: 'desc', q: '', min: 0, hideLow: true, columns: DEFAULT_COLUMNS });
    });

    it('rejects a negative minimum', () => {
        expect(toEconomyView(parseEconomySearch({ min: -4 })).min).toBe(0);
    });

    it('reads a text filter the router decoded as a number or a boolean', () => {
        expect(toEconomyView(parseEconomySearch({ q: 123 })).q).toBe('123');
        expect(toEconomyView(parseEconomySearch({ q: true })).q).toBe('true');
        expect(toEconomyView(parseEconomySearch({ q: '  divine ' })).q).toBe('divine');
    });

    it('reads a full view', () => {
        const view = toEconomyView(parseEconomySearch({ sort: 'd7', dir: 'asc', q: 'orb', min: 50, hideLow: false, cols: 'h1,trend' }));

        expect(view).toEqual({ sort: 'd7', dir: 'asc', q: 'orb', min: 50, hideLow: false, columns: ['h1', 'trend'] });
    });
});

describe('columns param', () => {
    it('round-trips any choice, in column order', () => {
        expect(parseColumns(toColumnsParam(['trend', 'h1']))).toEqual(['h1', 'trend']);
        expect(parseColumns(toColumnsParam([]))).toEqual([]);
    });

    it('is absent at the default, so a plain view keeps a plain URL', () => {
        expect(toColumnsParam(DEFAULT_COLUMNS)).toBeUndefined();
    });

    it('falls back to the default when nothing in it is a column', () => {
        expect(parseColumns('x,y')).toEqual(DEFAULT_COLUMNS);
    });
});

describe('item search', () => {
    it('defaults to 7 days, also for a range it does not know', () => {
        expect(toRange(parseItemSearch({}))).toBe('7d');
        expect(toRange(parseItemSearch({ range: '1y' }))).toBe('7d');
    });

    it('keeps a valid range', () => {
        expect(toRange(parseItemSearch({ range: 'league' }))).toBe('league');
    });
});
