import type { Pool } from 'pg';
import { withCollectorLock } from './lock.js';
import type { RunSummary } from './store.js';

export const CYCLE_INTERVAL_MS = 15 * 60 * 1_000;

/** The first cycle waits this long after boot when none has ever run, so the API is up and answering first. */
const FIRST_CYCLE_DELAY_MS = 5_000;

export interface SchedulerOptions {
    /** Pool the lock connection comes from. */
    pool: Pool;
    /** One cycle. Runs only while this process holds the lock. */
    runCycle: () => Promise<RunSummary>;
    /** Marks cycles a crashed process left `running` as `abandoned`. Only called while holding the lock. */
    abandonStaleRuns: () => Promise<number>;
    /** When the newest cycle began, from the database. */
    loadLastStart: () => Promise<Date | null>;
    onError: (message: string, error: unknown) => void;
    intervalMs?: number;
    now?: () => number;
}

export interface Scheduler {
    /** Runs one cycle now (under the lock) and resolves when it is done. `ran` is false when another process holds the lock. */
    runNow(): Promise<{ ran: boolean }>;
    /** Stops scheduling and waits for the cycle in flight. */
    stop(): Promise<void>;
}

/** Milliseconds until the next cycle: `interval` after the last one began, so a restart never causes an extra poll. */
export function toDelay(lastStart: Date | null, now: number, intervalMs: number): number {
    if (!lastStart) return FIRST_CYCLE_DELAY_MS;

    return Math.max(FIRST_CYCLE_DELAY_MS, lastStart.getTime() + intervalMs - now);
}

/** An in-process interval: no queue, no new dependency. The advisory lock is what keeps two cycles from overlapping. */
export function startScheduler(options: SchedulerOptions): Scheduler {
    const intervalMs = options.intervalMs ?? CYCLE_INTERVAL_MS;
    const now = options.now ?? Date.now;
    let timer: NodeJS.Timeout | undefined;
    let inFlight: Promise<unknown> = Promise.resolve();
    let stopped = false;

    async function runLocked(): Promise<{ ran: boolean }> {
        const result = await withCollectorLock(options.pool, async () => {
            // Holding the lock proves no other cycle is live, so a `running` row is a crashed one.
            await options.abandonStaleRuns();

            return options.runCycle();
        });

        return { ran: result.ran };
    }

    function schedule(delayMs: number): void {
        if (stopped) return;

        timer = setTimeout(() => {
            inFlight = runLocked()
                .catch((error: unknown) => options.onError('Collector cycle failed', error))
                .then(() => options.loadLastStart())
                .then((lastStart) => schedule(toDelay(lastStart, now(), intervalMs)))
                .catch((error: unknown) => {
                    options.onError('Collector scheduling failed', error);
                    schedule(intervalMs);
                });
        }, delayMs);
        // A pending timer alone must not keep the process alive.
        timer.unref();
    }

    options.loadLastStart().then(
        (lastStart) => schedule(toDelay(lastStart, now(), intervalMs)),
        (error: unknown) => {
            options.onError('Collector scheduling failed', error);
            schedule(intervalMs);
        },
    );

    return {
        runNow: () => runLocked(),
        async stop() {
            stopped = true;
            clearTimeout(timer);
            await inFlight;
        },
    };
}
