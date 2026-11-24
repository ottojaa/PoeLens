import { z } from 'zod';
import type { Game } from './game.js';

/** The currencies a price can be expressed in. Every stored price row carries all three. */
export const UnitSchema = z.enum(['divine', 'exalted', 'chaos']);

export type Unit = z.infer<typeof UnitSchema>;

export const UNITS = UnitSchema.options;

/** What a viewer or caller can ask prices in: one of the units, or `auto`, which picks the unit per row (see `PriceRow.unit`). */
export const UnitChoiceSchema = z.enum(['auto', ...UNITS]);

export type UnitChoice = z.infer<typeof UnitChoiceSchema>;

export const UNIT_CHOICES = UnitChoiceSchema.options;

/** One price in each unit. */
export const PricesSchema = z.object({
    divine: z.number(),
    exalted: z.number(),
    chaos: z.number(),
});

export type Prices = z.infer<typeof PricesSchema>;

/** The unit a read answers in when the caller names none: the currency each game's economy is quoted in day to day. */
export const DEFAULT_UNIT: Record<Game, Unit> = {
    poe2: 'exalted',
    poe1: 'chaos',
};
