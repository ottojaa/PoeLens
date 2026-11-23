import type { CollectorHealth, CollectorRunSummary } from '@poelens/shared';
import { probeQuery } from '../db/health-probe.js';
import type { CollectorRunStatus } from '../db/schema.js';
import { CYCLE_INTERVAL_MS } from './scheduler.js';

/** A cycle that has not succeeded for this long (two intervals: one may be skipped or cut) makes the collector degraded. */
export const STALE_AFTER_MS = 2 * CYCLE_INTERVAL_MS;

export interface RunRow {
    status: CollectorRunStatus;
    started_at: Date;
    finished_at: Date | null;
    requests: number;
    parse_errors: number;
    fetch_errors: number;
    error: string | null;
}

export interface CollectorRunFacts {
    /** The newest cycle that finished, whatever its outcome. */
    latest: RunRow | null;
    /** When the newest cycle that did not fail finished. */
    lastSuccessAt: Date | null;
}

function toRunSummary(row: RunRow): CollectorRunSummary {
    return {
        status: row.status,
        startedAt: row.started_at.toISOString(),
        finishedAt: row.finished_at?.toISOString() ?? null,
        requests: row.requests,
        parseErrors: row.parse_errors,
        fetchErrors: row.fetch_errors,
        error: row.error,
    };
}

function isDegraded(facts: CollectorRunFacts, now: number): boolean {
    // Nothing has run yet: the process has only just started, which is not a fault.
    if (!facts.latest) return false;

    // A poe.ninja shape change is the likeliest failure; it must not leave the views silently stale.
    if (facts.latest.parse_errors > 0) return true;

    if (!facts.lastSuccessAt) return true;

    return now - facts.lastSuccessAt.getTime() > STALE_AFTER_MS;
}

/** Pure: what /health says about the collector, from the run history (or null when the database could not be read). */
export function toCollectorHealth(enabled: boolean, facts: CollectorRunFacts | null, now: number): CollectorHealth {
    const lastRun = facts?.latest ? toRunSummary(facts.latest) : null;
    const lastSuccessAt = facts?.lastSuccessAt?.toISOString() ?? null;

    if (!enabled) return { status: 'disabled', lastRun, lastSuccessAt };

    // An enabled collector whose history cannot be read is treated as unhealthy rather than assumed fine.
    const degraded = facts === null || isDegraded(facts, now);

    return { status: degraded ? 'degraded' : 'ok', lastRun, lastSuccessAt };
}

/** Reads the run history through the /health probe pool, so a hung database cannot stall the endpoint. */
export async function probeCollectorRuns(source: string, game: string): Promise<CollectorRunFacts | null> {
    const rows = await probeQuery<RunRow & { last_success_at: Date | null }>(
        `SELECT status, started_at, finished_at, requests, parse_errors, fetch_errors, error,
                max(finished_at) FILTER (WHERE status IN ('success', 'partial')) OVER () AS last_success_at
           FROM collector_runs
          WHERE source = $1 AND game = $2 AND finished_at IS NOT NULL
          ORDER BY started_at DESC
          LIMIT 1`,
        [source, game],
    );

    if (rows === null) return null;

    const [row] = rows;

    return { latest: row ?? null, lastSuccessAt: row?.last_success_at ?? null };
}
