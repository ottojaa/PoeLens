import { describe, expect, it } from 'vitest';
import { findUnknownCategories, toScopeCategories, toScopeLabel } from './scope.js';

describe('toScopeCategories', () => {
    it('covers every category for all, and one group for a group', () => {
        const all = toScopeCategories('poe2', { group: 'all' });
        const uniques = toScopeCategories('poe2', { group: 'uniques' });
        const economy = toScopeCategories('poe2', { group: 'economy' });

        expect(uniques).toContain('UniqueArmours');
        expect(uniques).not.toContain('Currency');
        expect(economy).toContain('Currency');
        expect(economy).not.toContain('UniqueArmours');
        expect([...economy, ...uniques].sort()).toEqual([...all].sort());
    });

    it("keeps the game's order for a list, and leaves out a category the game does not have", () => {
        expect(toScopeCategories('poe2', { categories: ['UniqueWeapons', 'Currency', 'Nope'] })).toEqual(['Currency', 'UniqueWeapons']);
    });
});

describe('findUnknownCategories', () => {
    it('names the ids of a list the game has no category for', () => {
        expect(findUnknownCategories('poe2', { categories: ['Currency', 'Nope'] })).toEqual(['Nope']);
        expect(findUnknownCategories('poe2', { group: 'uniques' })).toEqual([]);
    });
});

describe('toScopeLabel', () => {
    it('reads a group in words and a list by its labels', () => {
        expect(toScopeLabel('poe2', { group: 'uniques' })).toBe('all uniques');
        expect(toScopeLabel('poe2', { categories: ['UniqueArmours', 'Currency'] })).toBe('Unique armour, Currency');
    });
});
