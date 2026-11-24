import { DEFAULT_UNIT, NotFoundError, type Game, type League, type LeagueRef, type UnitChoice } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';

/** The game and the league a request means. */
export interface LeagueContext {
    game: Game;
    league: LeagueRef;
}

/** What a row answer resolved: the league, and the unit asked for (`auto` stays `auto`). */
export interface PriceContext extends LeagueContext {
    unit: UnitChoice;
}

export interface ContextInput {
    game: Game;
    /** A league name, or `'current'` for the current challenge league. */
    league: string;
    unit?: UnitChoice;
}

const CURRENT = 'current';

/** Resolves the league a request means, so no caller ever has to know a league's name. */
export async function resolveLeague(db: Kysely<Database>, input: Pick<ContextInput, 'game' | 'league'>): Promise<LeagueContext> {
    const query = db.selectFrom('leagues').select(['name', 'current', 'hardcore']).where('game', '=', input.game);
    const row =
        input.league === CURRENT
            ? await query.where('current', '=', true).where('hardcore', '=', false).executeTakeFirst()
            : await query.where('name', '=', input.league).executeTakeFirst();

    if (!row) throw new NotFoundError('League', input.league);

    return { game: input.game, league: row };
}

/** Resolves the league and unit a request means, so no caller ever has to know a game's default unit either. */
export async function resolveContext(db: Kysely<Database>, input: ContextInput): Promise<PriceContext> {
    return { ...(await resolveLeague(db, input)), unit: input.unit ?? DEFAULT_UNIT[input.game] };
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
