import { toScopeCategories } from '@poelens/shared';
import { toAutoRow } from '../../prices/display-unit.js';
import { getScreener } from '../../prices/index.js';
import { answerOnce } from './answer-once.js';
import { toRankUnit } from './rank-unit.js';
import type { Resolver } from './types.js';

/**
 * Screener blocks: items that moved by the block's rule. They are ranked in one fixed unit; under Auto each row's price
 * is shown in the unit it reads best in, while `windowChange` stays the change the rule and the ranking used.
 */
export const resolveScreeners: Resolver<'screener'> = (db, context, entries) =>
    answerOnce(entries, context.log, async ({ block, unit }) => {
        const screened = await getScreener(db, {
            game: context.game,
            league: context.league,
            unit: toRankUnit(context.game, unit),
            categories: toScopeCategories(context.game, block.scope),
            windowHours: block.windowHours,
            direction: block.direction,
            minChangePct: block.minChangePct,
            minLiquidity: block.minLiquidity,
            minDivine: block.minDivine,
            limit: block.limit,
        });

        return { type: 'screener', unit: screened.unit, rows: unit === 'auto' ? screened.rows.map((row) => toAutoRow(row, context.game)) : screened.rows };
    });
