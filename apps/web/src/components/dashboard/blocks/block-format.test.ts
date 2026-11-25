import { describe, expect, it } from 'vitest';
import { toChartTitle, toMoversTitle, toScreenerRule, toTableTitle } from './block-format';

const table = { name: undefined, category: 'UniqueArmours', minLiquidity: 20, sort: 'd7' } as const;

describe('toTableTitle', () => {
    it('names the category, the liquidity floor and the sort', () => {
        expect(toTableTitle('poe2', table)).toBe('Unique armour · 20+ listings · by 7 days');
    });

    it('leaves out a floor of zero, and calls an exchange floor traded value', () => {
        expect(toTableTitle('poe2', { ...table, minLiquidity: 0 })).toBe('Unique armour · by 7 days');
        expect(toTableTitle('poe2', { ...table, category: 'Currency' })).toBe('Currency · 20+ div traded · by 7 days');
    });

    it('is the block name when it has one', () => {
        expect(toTableTitle('poe2', { ...table, name: 'Robes' })).toBe('Robes');
    });
});

describe('toMoversTitle', () => {
    it('reads "Movers · scope · window"', () => {
        expect(toMoversTitle('poe2', { name: undefined, scope: { group: 'uniques' }, window: '24h' })).toBe('Movers · all uniques · 24 h');
        expect(toMoversTitle('poe2', { name: undefined, scope: { categories: ['Currency'] }, window: '7d' })).toBe('Movers · Currency · 7 days');
    });
});

describe('toScreenerRule', () => {
    const rule = { direction: 'up', minChangePct: 20, windowHours: 3, minLiquidity: 50, minDivine: 1 } as const;

    it('lists the change, the listings and the floor in divine', () => {
        expect(toScreenerRule(rule)).toEqual(['+20% in 3 h', '50+ listings', '1+ div']);
    });

    it('shows a fall with a minus, and drops the limits that are off', () => {
        expect(toScreenerRule({ ...rule, direction: 'down', minLiquidity: 0, minDivine: null })).toEqual(['−20% in 3 h']);
        expect(toScreenerRule({ ...rule, minChangePct: 12.5, minDivine: 0 })).toEqual(['+12.5% in 3 h', '50+ listings']);
    });
});

describe('toChartTitle', () => {
    const item = { id: 1, name: 'Original Sin', baseType: null, category: 'UniqueJewels', icon: null };
    const quote = { id: 2, name: 'Divine Orb', baseType: null, category: 'Currency', icon: null };

    it('names the item and the range', () => {
        expect(toChartTitle({ name: undefined, range: '7d' }, { item, quote: null })).toBe('Original Sin · 7 days');
        expect(toChartTitle({ name: undefined, range: 'league' }, { item, quote })).toBe('Original Sin / Divine Orb · this league');
    });

    it('falls back to "Chart" before its data arrives, and to the block name', () => {
        expect(toChartTitle({ name: undefined, range: '24h' }, undefined)).toBe('Chart · 24 hours');
        expect(toChartTitle({ name: 'Mine', range: '30d' }, { item, quote: null })).toBe('Mine · 30 days');
    });
});
