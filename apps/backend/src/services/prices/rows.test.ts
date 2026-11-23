import { describe, expect, it } from 'vitest';
import { toPercentChange } from './rows.js';

describe('toPercentChange', () => {
    it('is the percent change to two decimals', () => {
        expect(toPercentChange(110, 100)).toBe(10);
        expect(toPercentChange(90, 100)).toBe(-10);
        expect(toPercentChange(1, 3)).toBe(-66.67);
    });

    it('is null without a usable reference', () => {
        expect(toPercentChange(5, null)).toBeNull();
        expect(toPercentChange(5, 0)).toBeNull();
    });
});
