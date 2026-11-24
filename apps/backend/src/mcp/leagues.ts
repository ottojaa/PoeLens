import { NotFoundError, type Game, type LeagueRef } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import { listLeagues } from '../services/prices/index.js';
import { resolveLeague } from '../services/prices/context.js';
import { ToolError } from './errors.js';

const HARDCORE = 'hardcore';

/** The current hardcore league, when the game has one. */
async function findCurrentHardcore(db: Kysely<Database>, game: Game): Promise<LeagueRef | undefined> {
    const row = await db
        .selectFrom('leagues')
        .select(['name', 'current', 'hardcore'])
        .where('game', '=', game)
        .where('current', '=', true)
        .where('hardcore', '=', true)
        .executeTakeFirst();

    return row;
}

function labelLeague(entry: { name: string; current: boolean; hardcore: boolean }): string {
    if (!entry.current) return entry.name;

    return entry.name + (entry.hardcore ? ' (current hardcore)' : ' (current)');
}

/**
 * The league a tool call means: "current" (the current softcore league), "hardcore" (the current hardcore league) or an
 * exact name. An unknown one answers with the leagues there are, so the model can pick again.
 */
export async function resolveLeagueArg(db: Kysely<Database>, game: Game, league: string): Promise<LeagueRef> {
    if (league === HARDCORE) {
        const hardcore = await findCurrentHardcore(db, game);

        if (hardcore) return hardcore;
    }

    try {
        return (await resolveLeague(db, { game, league })).league;
    } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;

        const known = await listLeagues(db, game);
        const names = known.map(labelLeague).join(', ');

        throw new ToolError(
            `No league "${league}" for ${game}. ` +
                (names
                    ? `Known leagues: ${names}. Use "current" or "hardcore" for the current softcore or hardcore league.`
                    : 'No leagues are known for this game yet.'),
        );
    }
}
