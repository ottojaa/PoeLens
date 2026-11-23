import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
    describe('the timer loop', () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        /** A scheduler on fake timers whose cycles record when they began, as `collector_runs` would. */
        function timedScheduler(runCycle: (calls: number) => Promise<RunSummary>) {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

            let clock = Date.UTC(2026, 10, 23, 12, 0, 0);
            let lastStart: Date | null = null;
            let calls = 0;
            let loads = 0;
            const onError = vi.fn();
            const scheduler = startScheduler({
                pool,
                runCycle: async () => {
                    calls += 1;
                    lastStart = new Date(clock);

                    return runCycle(calls);
                },
                abandonStaleRuns: async () => 0,
                loadLastStart: async () => {
                    loads += 1;

                    return lastStart;
                },
                onError,
                now: () => clock,
            });

            const advance = async (ms: number) => {
                clock += ms;
                await vi.advanceTimersByTimeAsync(ms);
            };

            // The next timer is set only after the cycle's lock is released and the last start is read again, which is the second load.
            const nextIsScheduled = () => vi.waitFor(() => expect(loads).toBeGreaterThanOrEqual(2));

            return { scheduler, onError, advance, calls: () => calls, nextIsScheduled };
        }

        it('runs the first cycle shortly after boot, then one interval after the last cycle began', async () => {
            const { scheduler, advance, calls, nextIsScheduled } = timedScheduler(async () => SUMMARY);

            await advance(0);
            await advance(5 * SECOND);
            await vi.waitFor(() => expect(calls()).toBe(1));
            await nextIsScheduled();

            await advance(CYCLE_INTERVAL_MS - SECOND);
            expect(calls()).toBe(1);

            await advance(SECOND);
            await vi.waitFor(() => expect(calls()).toBe(2));
            await scheduler.stop();
        });

        it('keeps scheduling after a cycle fails, and reports the failure', async () => {
            const { scheduler, onError, advance, calls, nextIsScheduled } = timedScheduler(async (call) => {
                if (call === 1) throw new Error('boom');

                return SUMMARY;
            });

            await advance(0);
            await advance(5 * SECOND);
            await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('Collector cycle failed', expect.any(Error)));
            await nextIsScheduled();

            await advance(CYCLE_INTERVAL_MS);
            await vi.waitFor(() => expect(calls()).toBe(2));
            await scheduler.stop();
        });

        it('waits for the cycle in flight when stopped, and schedules nothing afterwards', async () => {
            let finish: () => void = () => undefined;
            const { scheduler, advance, calls } = timedScheduler(
                () =>
                    new Promise<RunSummary>((resolve) => {
                        finish = () => resolve(SUMMARY);
                    }),
            );

            await advance(0);
            await advance(5 * SECOND);
            await vi.waitFor(() => expect(calls()).toBe(1));

            let stopped = false;
            const stopping = scheduler.stop().then(() => {
                stopped = true;
            });

            await advance(SECOND);
            expect(stopped).toBe(false);

            finish();
            await stopping;
            await advance(CYCLE_INTERVAL_MS * 2);
            expect(calls()).toBe(1);
        });
    });
});
