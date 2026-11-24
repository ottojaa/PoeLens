import { describe, expect, it } from 'vitest';
import { formatChange, formatLiquidity, formatPrice, formatUptime, toChangeDirection } from './format';

describe('formatUptime', () => {
    it.each([
        [0, '0s'],
        [45, '45s'],
        [125, '2m 5s'],
        [7_500, '2h 5m'],
        [90_061, '1d 1h'],
        [-5, '0s'],
    ])('%i seconds is %s', (seconds, expected) => {
        expect(formatUptime(seconds)).toBe(expected);
    });
});

describe('formatPrice', () => {
    it('shows fewer decimals the larger the price gets', () => {
        expect(formatPrice(2_487_006.5)).toBe('2.49M');
        expect(formatPrice(5590.84)).toBe('5,591');
        expect(formatPrice(729.44)).toBe('729.4');
        expect(formatPrice(2.456)).toBe('2.46');
        expect(formatPrice(0.0456)).toBe('0.046');
        expect(formatPrice(0.00012)).toBe('0.00012');
        expect(formatPrice(0)).toBe('0');
    });
});

describe('formatChange', () => {
    it('puts an arrow on every real change and a dash on a missing one', () => {
        expect(formatChange(29.64)).toBe('▲ +29.6%');
        expect(formatChange(-3.94)).toBe('▼ −3.9%');
        expect(formatChange(0.01)).toBe('0.0%');
        expect(formatChange(null)).toBe('—');
    });

    it('calls a change that rounds to zero flat', () => {
        expect(toChangeDirection(0.04)).toBe('flat');
        expect(toChangeDirection(-0.04)).toBe('flat');
        expect(toChangeDirection(1)).toBe('up');
        expect(toChangeDirection(-1)).toBe('down');
        expect(toChangeDirection(null)).toBe('flat');
    });
});

describe('formatLiquidity', () => {
    it('keeps the decimals of a small traded volume, which is in divine', () => {
        expect(formatLiquidity({ kind: 'volume', value: 0.04 })).toBe('0.040');
        expect(formatLiquidity({ kind: 'volume', value: 8676.4 })).toBe('8,676');
    });

    it('shows listings as a whole number', () => {
        expect(formatLiquidity({ kind: 'listings', value: 1234 })).toBe('1,234');
    });
});
