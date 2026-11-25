import { NotFoundError, toHistoryWindow, type BlockData, type ChartDataBlock, type UnitChoice } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../../db/schema.js';
import { getHistory, getPairSeries, resolveLeague } from '../../prices/index.js';
import { answerOnce } from './answer-once.js';
import type { Resolver, ResolverContext } from './types.js';

/** When a league was first seen: where the "league" range starts. Null for a league the catalog does not have. */
async function loadLeagueStart(db: Kysely<Database>, context: ResolverContext): Promise<string | undefined> {
    const { game, league } = await resolveLeague(db, context);
    const row = await db.selectFrom('leagues').select('first_seen').where('game', '=', game).where('name', '=', league.name).executeTakeFirst();

    return row?.first_seen.toISOString();
}

async function resolveChart(db: Kysely<Database>, context: ResolverContext, block: ChartDataBlock, unit: UnitChoice): Promise<BlockData | null> {
    const leagueStart = block.range === 'league' ? await loadLeagueStart(db, context) : undefined;
    const window = toHistoryWindow(block.range, leagueStart, context.now);

    if (!window) return null;

    if (block.quote !== null) {
        const series = await getPairSeries(db, {
            game: context.game,
            league: context.league,
            a: block.item,
            b: block.quote,
            bucket: window.bucket,
            from: new Date(window.from),
            to: context.now,
        });

        return { type: 'chart', item: series.a, quote: series.b, unit: null, points: series.points };
    }

    const history = await getHistory(db, {
        game: context.game,
        league: context.league,
        item: block.item,
        unit,
        bucket: window.bucket,
        from: window.from,
        to: context.now.toISOString(),
        includeLowConfidence: false,
    });

    return { type: 'chart', item: history.item, quote: null, unit: history.unit, points: history.points };
}

/**
 * Chart blocks: one item's price history in the panel's unit (Auto picks one unit for the whole line, as the item page
 * does), or a pair's rate. The range maps to a bucket and a start the way the item page maps it. An item the catalog no
 * longer has answers null.
 */
export const resolveCharts: Resolver<'chart'> = (db, context, entries) =>
    answerOnce(entries, context.log, async ({ block, unit }) => {
        try {
            return await resolveChart(db, context, block, unit);
        } catch (error) {
            if (error instanceof NotFoundError) return null;

            throw error;
        }
    });
