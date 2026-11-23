import { describe, expect, it } from 'vitest';
import { formatUptime } from './format';

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
