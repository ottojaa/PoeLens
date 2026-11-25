import { describe, expect, it } from 'vitest';
import { hasLine, toTrendChange } from './trend.js';

describe('toTrendChange', () => {
    it('is the percent from the first point to the last', () => {
        expect(toTrendChange([100, 150, 125])).toBe(25);
    });

    it('is null without a line or from a zero start', () => {
        expect(toTrendChange([5])).toBeNull();
        expect(toTrendChange([0, 5])).toBeNull();
    });
});

describe('hasLine', () => {
    it('needs two points', () => {
        expect(hasLine(undefined)).toBe(false);
        expect(hasLine([1])).toBe(false);
        expect(hasLine([1, 2])).toBe(true);
    });
});
