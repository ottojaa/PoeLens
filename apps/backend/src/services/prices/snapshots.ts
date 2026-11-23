import type { Game } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';

/** The newest successfully parsed response for one category: the rows written from it are that category's latest prices. */
export interface Snapshot {
    category: string;
    rawId: number;
    time: Date;
}

/**
 * The newest snapshot of each category in a league (of the given categories, or of all). Reading "latest" from the
 * archive instead of scanning price history keeps it cheap however long history grows, and gives the rule its meaning: an
 * item missing from its category's newest snapshot is unlisted, and a poe.ninja outage leaves the last snapshot standing.
 */
export async function loadLatestSnapshots(db: Kysely<Database>, game: Game, league: string, categories?: string[]): Promise<Snapshot[]> {
    if (categories && !categories.length) return [];

    const rows = await db
        .selectFrom('raw_responses')
        .select(['category', 'id', 'fetched_at'])
        .distinctOn('category')
        .where('game', '=', game)
        .where('league', '=', league)
        .where('parser_version', 'is not', null)
        .where('parse_error', 'is', null)
        .$if(categories !== undefined, (query) => query.where('category', 'in', categories!))
        .orderBy('category')
        .orderBy('fetched_at', 'desc')
        .orderBy('id', 'desc')
        .execute();

    return rows.map((row) => ({ category: row.category, rawId: row.id, time: row.fetched_at }));
}
