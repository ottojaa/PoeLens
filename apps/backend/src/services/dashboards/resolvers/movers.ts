import { toScopeCategories, type PriceRow } from '@poelens/shared';
import { toAutoRow } from '../../prices/display-unit.js';
import { getMoversIn } from '../../prices/index.js';
import { answerOnce } from './answer-once.js';
import { toRankUnit } from './rank-unit.js';
import type { Resolver } from './types.js';

/**
 * Movers blocks: the biggest risers and fallers of the scope's categories over the window. They are ranked in one fixed
 * unit (a change in exalted and a change in divine do not compare); under Auto each row's price is then shown in the
 * unit it reads best in, with its change still the one it was ranked by.
 */
export const resolveMovers: Resolver<'movers'> = (db, context, entries) =>
    answerOnce(entries, context.log, async ({ block, unit }) => {
        const ranked = await getMoversIn(db, {
            game: context.game,
            league: context.league,
            categories: toScopeCategories(context.game, block.scope),
            window: block.window,
            unit: toRankUnit(context.game, unit),
            limit: block.limit,
            includeLowConfidence: false,
        });
        const show = (rows: PriceRow[]): PriceRow[] => (unit === 'auto' ? rows.map((row) => toAutoRow(row, context.game)) : rows);

        return { type: 'movers', unit: ranked.unit, risers: show(ranked.risers), fallers: show(ranked.fallers) };
    });
