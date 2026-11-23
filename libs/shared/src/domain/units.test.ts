import { describe, expect, it } from 'vitest';
import { GAMES } from './game.js';
import { DEFAULT_UNIT, UnitSchema } from './units.js';

describe('DEFAULT_UNIT', () => {
    it('names a valid unit for every game', () => {
        for (const game of GAMES) expect(UnitSchema.safeParse(DEFAULT_UNIT[game]).success).toBe(true);
    });
});
