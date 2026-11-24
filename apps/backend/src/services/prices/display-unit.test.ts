import { describe, expect, it } from 'vitest';
import { toRowUnit } from './display-unit.js';

const prices = (divine: number, exalted: number, chaos: number) => ({ divine, exalted, chaos });

describe('toRowUnit', () => {
    it('returns a fixed choice whatever the price', () => {
        expect(toRowUnit('chaos', prices(5000, 2_000_000, 70_000), 'poe2')).toBe('chaos');
        expect(toRowUnit('divine', prices(0.001, 0.4, 0.01), 'poe2')).toBe('divine');
    });

    it('reads in divine from 1 div, in chaos from 1 c, and in exalted below 1 c', () => {
        expect(toRowUnit('auto', prices(5715, 2_548_000, 76_800), 'poe2')).toBe('divine');
        expect(toRowUnit('auto', prices(1, 445.9, 13.44), 'poe2')).toBe('divine');
        expect(toRowUnit('auto', prices(0.2398, 106.9, 3.22), 'poe2')).toBe('chaos');
        expect(toRowUnit('auto', prices(0.01438, 6.41, 0.19), 'poe2')).toBe('exalted');
    });

    it('puts the edges where the rule says, with a margin for rounding in the rates', () => {
        expect(toRowUnit('auto', prices(0.9999, 445, 13.4), 'poe2')).toBe('divine');
        expect(toRowUnit('auto', prices(0.0744, 33.17, 0.99994), 'poe2')).toBe('chaos');
        expect(toRowUnit('auto', prices(0.0736, 32.8, 0.99), 'poe2')).toBe('exalted');
    });

    it('falls back to the default unit for a game with no ladder', () => {
        expect(toRowUnit('auto', prices(5, 2000, 70), 'poe1')).toBe('chaos');
    });
});
