import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../testing/test-database.js';
import { withCollectorLock } from './lock.js';
import { CYCLE_INTERVAL_MS, startScheduler, toDelay } from './scheduler.js';
import type { RunSummary } from './store.js';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

describe('toDelay', () => {
    it('waits a few seconds for the first cycle ever, so the API answers first', () => {
        expect(toDelay(null, Date.now(), CYCLE_INTERVAL_MS)).toBe(5 * SECOND);
    });

    it('runs one interval after the last cycle began, so a restart causes no extra poll', () => {
        const now = Date.UTC(2026, 10, 23, 12, 10, 0);
        const lastStart = new Date(Date.UTC(2026, 10, 23, 12, 0, 0));

        expect(toDelay(lastStart, now, CYCLE_INTERVAL_MS)).toBe(5 * MINUTE);
    });

    it('runs soon, but not instantly, when a cycle is overdue', () => {
        const now = Date.UTC(2026, 10, 23, 14, 0, 0);
        const lastStart = new Date(Date.UTC(2026, 10, 23, 12, 0, 0));

        expect(toDelay(lastStart, now, CYCLE_INTERVAL_MS)).toBe(5 * SECOND);
    });
});

const SUMMARY: RunSummary = { status: 'success', requests: 1, stored: 1, unchanged: 0, parseErrors: 0, fetchErrors: 0, priceRows: 1, error: null };

describe.skipIf(SKIP_DB_TESTS)('the scheduler', () => {
    let test: TestDatabase;
    let pool: Pool;

    beforeAll(async () => {
        test = await createTestDatabase();
        pool = new Pool({ connectionString: test.url, max: 3 });
    });

    afterAll(async () => {
        await pool.end();
        await test.close();
    });

    function schedulerWith(runCycle: () => Promise<RunSummary>, abandonStaleRuns = vi.fn().mockResolvedValue(0)) {
        const scheduler = startScheduler({
            pool,
            runCycle,
            abandonStaleRuns,
            // Far in the future, so the timer never fires during the test.
            loadLastStart: async () => new Date(Date.now() + 60 * MINUTE),
            onError: () => undefined,
        });

        return { scheduler, abandonStaleRuns };
    }

    it('abandons stale runs before it runs a cycle, only while holding the lock', async () => {
        const order: string[] = [];
        const { scheduler } = schedulerWith(
            async () => {
                order.push('cycle');

                return SUMMARY;
            },
            vi.fn(async () => {
                order.push('abandon');

                return 1;
            }),
        );

        expect(await scheduler.runNow()).toEqual({ ran: true });
        expect(order).toEqual(['abandon', 'cycle']);
        await scheduler.stop();
    });

    it('skips the cycle, and the abandoning, while another process holds the lock', async () => {
        const runCycle = vi.fn().mockResolvedValue(SUMMARY);
        const { scheduler, abandonStaleRuns } = schedulerWith(runCycle);
        let result: { ran: boolean } | undefined;

        await withCollectorLock(pool, async () => {
            result = await scheduler.runNow();
        });

        expect(result).toEqual({ ran: false });
        expect(runCycle).not.toHaveBeenCalled();
        expect(abandonStaleRuns).not.toHaveBeenCalled();
        await scheduler.stop();
    });

    it('releases the lock after a cycle that throws', async () => {
        const { scheduler } = schedulerWith(async () => {
            throw new Error('boom');
        });

        await expect(scheduler.runNow()).rejects.toThrow('boom');
        expect(await withCollectorLock(pool, async () => 'free')).toEqual({ ran: true, value: 'free' });
        await scheduler.stop();
    });
});
