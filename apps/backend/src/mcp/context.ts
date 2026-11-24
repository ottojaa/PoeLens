import { GameSchema, UnitChoiceSchema } from '@poelens/shared';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../db/schema.js';
import type { Principal } from '../services/api-tokens/index.js';

/** What every tool gets: the database, who is calling (the only thing a tool reads about the caller) and where to log. */
export interface ToolContext {
    db: Kysely<Database>;
    principal: Principal;
    log: (error: unknown) => void;
    /** The time the answer is written at: ages are measured against it. */
    now: () => Date;
}

/** The inputs every read tool shares, all optional. */
export const readDefaults = {
    game: GameSchema.default('poe2').describe('Which game. Defaults to poe2 (Path of Exile 2).'),
    league: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .default('current')
        .describe('"current" (the current softcore challenge league, the default), or an exact league name such as a hardcore league.'),
    unit: UnitChoiceSchema.default('auto').describe('"auto" (default) shows each price in the unit it reads best in; or divine, exalted or chaos.'),
};
