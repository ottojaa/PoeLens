import { filterRows, sortRows } from '@poelens/shared';
import { getTable } from '../../prices/index.js';
import { answerOnce } from './answer-once.js';
import type { Resolver } from './types.js';

/**
 * Price table blocks: the category's rows exactly as the economy view builds them (the same filter, then the same sort,
 * over the same rows), cut to the block's limit. Every row carries its sparkline, so showing the trend column never refetches.
 */
export const resolveTables: Resolver<'table'> = (db, context, entries) =>
    answerOnce(entries, context.log, async ({ block, unit }) => {
        const table = await getTable(db, {
            game: context.game,
            league: context.league,
            category: block.category,
            unit,
            includeLowConfidence: !block.hideLowConfidence,
            sparkline: true,
        });
        const matching = sortRows(filterRows(table.rows, block.q, block.minLiquidity), block.sort, block.dir);

        return { type: 'table', rows: matching.slice(0, block.limit), total: matching.length };
    });
