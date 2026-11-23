import { DEFAULT_UNIT, NotFoundError, type Game, type League, type LeagueRef, type Unit } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';

/** What every price answer resolved: the game, the league `'current'` pointed at, and the unit prices are in. */
export interface PriceContext {
    game: Game;
    league: LeagueRef;
    unit: Unit;
}

export interface ContextInput {
    game: Game;
    /** A league name, or `'current'` for the current challenge league. */
    league: string;
    unit?: Unit;
}

const CURRENT = 'current';

/** Resolves the league and unit a request means, so no caller ever has to know a league's name or a game's default unit. */
export async function resolveContext(db: Kysely<Database>, input: ContextInput): Promise<PriceContext> {
    const query = db.selectFrom('leagues').select(['name', 'current', 'hardcore']).where('game', '=', input.game);
    const row =
        input.league === CURRENT
            ? await query.where('current', '=', true).where('hardcore', '=', false).executeTakeFirst()
            : await query.where('name', '=', input.league).executeTakeFirst();

    if (!row) throw new NotFoundError('League', input.league);

    return { game: input.game, league: row, unit: input.unit ?? DEFAULT_UNIT[input.game] };
}

/** Every league seen for a game: the current challenge league and its hardcore version first. */
export async function listLeagues(db: Kysely<Database>, game: Game): Promise<League[]> {
    const rows = await db.selectFrom('leagues').selectAll().where('game', '=', game).orderBy('current', 'desc').orderBy('hardcore').orderBy('name').execute();

    return rows.map((row) => ({
        game,
        name: row.name,
        current: row.current,
        hardcore: row.hardcore,
        firstSeen: row.first_seen.toISOString(),
        lastSeen: row.last_seen.toISOString(),
    }));
}
