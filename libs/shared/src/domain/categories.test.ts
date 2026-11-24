import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoriesOnEndpoint } from './categories.js';

describe('categories', () => {
    it('has unique ids and a label for every PoE 2 category', () => {
        const ids = CATEGORIES.poe2.map((category) => category.id);

        expect(new Set(ids).size).toBe(ids.length);
        expect(CATEGORIES.poe2.every((category) => category.label.length > 0)).toBe(true);
    });

    it('lists the exchange categories before the stash ones, the order the collector requests them in', () => {
        const endpoints = CATEGORIES.poe2.map((category) => category.endpoint);
        const firstStash = endpoints.indexOf('stash');

        expect(endpoints.slice(0, firstStash).every((endpoint) => endpoint === 'exchange')).toBe(true);
        expect(endpoints.slice(firstStash).every((endpoint) => endpoint === 'stash')).toBe(true);
    });

    it('keeps precursor tablets on the stash endpoint but out of the uniques group', () => {
        const tablets = CATEGORIES.poe2.find((category) => category.id === 'PrecursorTablets');

        expect(tablets).toMatchObject({ endpoint: 'stash', group: 'economy' });
        expect(categoriesOnEndpoint('poe2', 'stash').filter((category) => category.group === 'uniques')).toHaveLength(8);
    });

    it('has no PoE 1 categories yet', () => {
        expect(CATEGORIES.poe1).toEqual([]);
    });
});
