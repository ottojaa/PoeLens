import type { BlockData, DataBlock, Game, UnitChoice } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../../db/schema.js';

/** What every block of one data request shares. */
export interface ResolverContext {
    game: Game;
    /** A league name, or `'current'`. */
    league: string;
    /** The moment the request is answered at: where "the last 24 hours" ends. */
    now: Date;
}

/** A block with the unit its panel reads it in (the panel's own, else the request's). */
export interface ResolverEntry<B extends DataBlock = DataBlock> {
    block: B;
    unit: UnitChoice;
}

/** Answers every block of one type in a request, by block id. A block it cannot answer is null. */
export type Resolver<T extends DataBlock['type']> = (
    db: Kysely<Database>,
    context: ResolverContext,
    entries: readonly ResolverEntry<Extract<DataBlock, { type: T }>>[],
) => Promise<Map<string, BlockData | null>>;
