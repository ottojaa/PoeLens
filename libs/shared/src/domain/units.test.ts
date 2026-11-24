import { describe, expect, it } from 'vitest';
import { GAMES } from './game.js';
import { DEFAULT_UNIT, UNIT_CHOICES, UnitChoiceSchema, UnitSchema } from './units.js';

describe('DEFAULT_UNIT', () => {
    it('names a valid unit for every game', () => {
        for (const game of GAMES) expect(UnitSchema.safeParse(DEFAULT_UNIT[game]).success).toBe(true);
    });
});

describe('UnitChoiceSchema', () => {
    it('is the three units and auto, auto first', () => {
        expect(UNIT_CHOICES).toEqual(['auto', 'divine', 'exalted', 'chaos']);
        expect(UnitChoiceSchema.safeParse('auto').success).toBe(true);
        expect(UnitSchema.safeParse('auto').success).toBe(false);
    });
});
