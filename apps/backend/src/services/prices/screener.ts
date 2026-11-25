import type { Game, LeagueRef, ScreenerRow, Unit } from '@poelens/shared';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { resolveLeague } from './context.js';
import { queryRows, referenceJoin, toPercentChange, toPriceRow, type RowResult } from './rows.js';
import { UNIT_COLUMN } from './series.js';
import { loadLatestSnapshots } from './snapshots.js';

const HOUR_SECONDS = 3_600;

export interface ScreenerQuery {
    game: Game;
    /** A league name, or `'current'`. */
    league: string;
    /** The unit changes are measured and ranked in: changes in different units do not rank against each other. */
    unit: Unit;
    categories: string[];
    windowHours: number;
    direction: 'up' | 'down';
    /** A magnitude in percent: 20 matches a rise of 20% or more going up, a fall of 20% or more going down. */
    minChangePct: number;
    /** The fewest listings (or the lowest volume, for an exchange item) an item needs. */
    minLiquidity: number;
    /** The least an item is worth, in divine; null for no floor. */
    minDivine: number | null;
    limit: number;
}

export interface ScreenerResult {
    game: Game;
    league: LeagueRef;
    unit: Unit;
    rows: ScreenerRow[];
}

/** A row with the price it had about one window ago, in every unit. */
interface ScreenedRow extends RowResult {
    w_divine: number | null;
    w_exalted: number | null;
    w_chaos: number | null;
}

/**
 * Items of the latest snapshots of some categories whose price moved by at least a given percent, up or down, over any
 * window of 1 to 168 hours, strongest first. A row needs a confident price now and a confident reference price about one
 * window ago, so a lone listing never makes a mover. The guards, the ranking and the limit all run in SQL.
 */
export async function getScreener(db: Kysely<Database>, query: ScreenerQuery): Promise<ScreenerResult> {
    const { game, league } = await resolveLeague(db, query);
    const snapshots = await loadLatestSnapshots(db, game, league.name, query.categories);

    if (!snapshots.length) return { game, league, unit: query.unit, rows: [] };

    const column = UNIT_COLUMN[query.unit];
    const change = sql`(p.${sql.raw(column)} / wref.${sql.raw(column)} - 1) * 100`;
    const passes = query.direction === 'up' ? sql`${change} >= ${query.minChangePct}` : sql`${change} <= ${-query.minChangePct}`;
    const liquidity = query.minLiquidity > 0 ? sql`AND coalesce(p.listings, p.volume) >= ${query.minLiquidity}` : sql``;
    const floor = query.minDivine === null ? sql`` : sql`AND p.divine >= ${query.minDivine}`;
    const rows = await queryRows<ScreenedRow>(
        db,
        {
            game,
            unit: query.unit,
            rawIds: snapshots.map((snapshot) => snapshot.rawId),
            times: snapshots.map((snapshot) => snapshot.time),
            includeLowConfidence: false,
        },
        {
            select: sql`, wref.divine AS w_divine, wref.exalted AS w_exalted, wref.chaos AS w_chaos`,
            joins: referenceJoin('wref', query.windowHours * HOUR_SECONDS),
            where: sql`AND wref.${sql.raw(column)} > 0 AND ${passes} ${liquidity} ${floor}`,
            orderBy: sql`${change} ${query.direction === 'up' ? sql`DESC` : sql`ASC`}, i.name`,
            limit: query.limit,
        },
    );

    return {
        game,
        league,
        unit: query.unit,
        rows: rows.map((row) => ({ ...toPriceRow(row, query.unit, game), windowChange: toPercentChange(row[query.unit], row[`w_${query.unit}`]) ?? 0 })),
    };
}
