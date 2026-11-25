import { describe, expect, it, vi } from 'vitest';
import { answerOnce } from './answer-once.js';
import type { ResolverEntry } from './types.js';

const chart = (id: string, item: number): ResolverEntry<Extract<ResolverEntry['block'], { type: 'chart' }>> => ({
    block: { id, type: 'chart', item, quote: null, range: '7d' },
    unit: 'divine',
});

describe('answerOnce', () => {
    it('logs a throwing answer and nulls only the blocks with those settings', async () => {
        const log = { error: vi.fn() };
        const failure = new Error('Query timed out');
        const answers = await answerOnce([chart('a', 1), chart('b', 2), chart('c', 1)], log, async ({ block }) => {
            if (block.item === 1) throw failure;

            return { type: 'movers', unit: 'divine', risers: [], fallers: [] };
        });

        expect(Object.fromEntries(answers)).toMatchObject({ a: null, b: { type: 'movers' }, c: null });
        expect(log.error).toHaveBeenCalledTimes(1);
        expect(log.error).toHaveBeenCalledWith({ err: failure, type: 'chart' }, 'Dashboard blocks could not be priced: chart');
    });
});
