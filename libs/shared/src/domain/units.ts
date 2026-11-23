import { z } from 'zod';
import type { Game } from './game.js';

/** The currencies a price can be expressed in. Every stored price row carries all three. */
export const UnitSchema = z.enum(['divine', 'exalted', 'chaos']);

export type Unit = z.infer<typeof UnitSchema>;

export const UNITS = UnitSchema.options;

/** The unit a read answers in when the caller names none: the currency each game's economy is quoted in day to day. */
export const DEFAULT_UNIT: Record<Game, Unit> = {
    poe2: 'exalted',
    poe1: 'chaos',
};
