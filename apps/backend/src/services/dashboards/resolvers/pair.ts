import type { BlockData } from '@poelens/shared';
import { getPairs } from '../../prices/pairs.js';
import type { Resolver } from './types.js';

/** Pair blocks: the rate of each, read in divine whatever unit the panel is in (the pair itself reads in its B). */
export const resolvePairs: Resolver<'pair'> = async (db, context, entries) => {
    const rates = await getPairs(db, { ...context, pairs: entries.map((entry) => ({ a: entry.block.a, b: entry.block.b })) });
    const answers = new Map<string, BlockData | null>();

    for (const { block } of entries) {
        const rate = rates.find((candidate) => candidate.a.id === block.a && candidate.b.id === block.b);

        answers.set(block.id, rate ? { type: 'pair', ...rate } : null);
    }

    return answers;
};
