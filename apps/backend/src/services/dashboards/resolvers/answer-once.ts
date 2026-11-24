import type { BlockData, DataBlock } from '@poelens/shared';
import type { ResolverEntry } from './types.js';

/** What a block's answer depends on: its settings and the unit it reads in, never its id. */
function toAnswerKey(entry: ResolverEntry): string {
    return JSON.stringify([{ ...entry.block, id: undefined }, entry.unit]);
}

/**
 * Answers every entry by running `answer` once per distinct set of settings and unit, so two panels that show the same
 * table, or the same block twice, cost one query. A throw answers null for that set alone.
 */
export async function answerOnce<B extends DataBlock>(
    entries: readonly ResolverEntry<B>[],
    answer: (entry: ResolverEntry<B>) => Promise<BlockData | null>,
): Promise<Map<string, BlockData | null>> {
    const distinct = new Map<string, ResolverEntry<B>>();

    for (const entry of entries) if (!distinct.has(toAnswerKey(entry))) distinct.set(toAnswerKey(entry), entry);

    const answers = new Map(
        await Promise.all(
            [...distinct].map(async ([key, entry]) => {
                const data = await answer(entry).catch(() => null);

                return [key, data] as const;
            }),
        ),
    );

    return new Map(entries.map((entry) => [entry.block.id, answers.get(toAnswerKey(entry)) ?? null]));
}
