import { z } from 'zod';

/**
 * Which game a league, item or price belongs to. Every table and route that holds game data carries it, so PoE 1
 * can be added next to PoE 2 without a migration of the data model.
 */
export const GameSchema = z.enum(['poe1', 'poe2']);

export type Game = z.infer<typeof GameSchema>;

export const GAMES = GameSchema.options;

export const GAME_LABELS: Record<Game, string> = {
    poe1: 'Path of Exile',
    poe2: 'Path of Exile 2',
};
