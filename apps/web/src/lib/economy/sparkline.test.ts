import { describe, expect, it } from 'vitest';
import { buildSparklinePath, SPARKLINE_HEIGHT, SPARKLINE_WIDTH } from './sparkline';

describe('buildSparklinePath', () => {
    it('draws nothing for no points', () => {
        expect(buildSparklinePath([])).toBe('');
        expect(buildSparklinePath(undefined)).toBe('');
    });

    it('draws nothing for one point: there is no line to make', () => {
        expect(buildSparklinePath([5])).toBe('');
    });

    it('spreads n points left to right with the lowest at the bottom and the highest at the top', () => {
        const path = buildSparklinePath([1, 3, 2], 100, 30);

        expect(path).toBe('M2 28 L50 2 L98 15');
    });

    it('keeps every coordinate inside the box', () => {
        const numbers =
            buildSparklinePath([10, 400, 20, 9000, 5, 77, 3])
                .match(/-?\d+(\.\d+)?/g)
                ?.map(Number) ?? [];

        expect(numbers).toHaveLength(14);

        numbers.forEach((value, index) => {
            const limit = index % 2 === 0 ? SPARKLINE_WIDTH : SPARKLINE_HEIGHT;

            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(limit);
        });
    });

    it('draws a flat series as a line across the middle', () => {
        expect(buildSparklinePath([4, 4, 4], 100, 30)).toBe('M2 15 L50 15 L98 15');
    });
});
