import { describe, expect, it } from 'vitest';
import { toCategoryLabel } from './category-label';

describe('toCategoryLabel', () => {
    it('gives the label of a known category', () => {
        expect(toCategoryLabel('poe2', 'UncutGems')).toBe('Uncut gems');
        expect(toCategoryLabel('poe2', 'SoulCores')).toBe('Soul cores');
    });

    it('falls back to the id for an unknown category', () => {
        expect(toCategoryLabel('poe2', 'Nonsense')).toBe('Nonsense');
    });
});
