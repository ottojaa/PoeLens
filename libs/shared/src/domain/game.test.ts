import { describe, expect, it } from 'vitest';
import { GAME_LABELS, GAMES, GameSchema } from './game.js';

describe('GameSchema', () => {
    it('accepts the two games and nothing else', () => {
        expect(GameSchema.parse('poe1')).toBe('poe1');
        expect(GameSchema.parse('poe2')).toBe('poe2');
        expect(GameSchema.safeParse('poe3').success).toBe(false);
        expect(GameSchema.safeParse('POE2').success).toBe(false);
    });

    it('has a label for every game', () => {
        expect(Object.keys(GAME_LABELS).sort()).toEqual([...GAMES].sort());
    });
});
