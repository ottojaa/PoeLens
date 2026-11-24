import { NotFoundError, type Game, type LeagueRef } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import { listLeagues } from '../services/prices/index.js';
import { resolveLeague } from '../services/prices/context.js';
import { ToolError } from './errors.js';

/** The league a tool call means. An unknown name answers with the leagues there are, so the model can pick again. */
export async function resolveLeagueArg(db: Kysely<Database>, game: Game, league: string): Promise<LeagueRef> {
    try {
        return (await resolveLeague(db, { game, league })).league;
    } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;

        const known = await listLeagues(db, game);
        const names = known.map((entry) => entry.name + (entry.current && !entry.hardcore ? ' (current)' : '')).join(', ');

        throw new ToolError(
            `No league "${league}" for ${game}. ` +
                (names ? `Known leagues: ${names}. Use "current" for the current league.` : 'No leagues are known for this game yet.'),
        );
    }
}
