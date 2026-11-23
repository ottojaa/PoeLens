import { describe, expect, it } from 'vitest';
import { STALE_AFTER_MS, toCollectorHealth, type RunRow } from './health.js';

const NOW = Date.parse('2026-11-23T12:00:00Z');

function run(overrides: Partial<RunRow> = {}): RunRow {
    return {
        status: 'success',
        started_at: new Date(NOW - 60_000),
        finished_at: new Date(NOW - 30_000),
        requests: 24,
        parse_errors: 0,
        fetch_errors: 0,
        error: null,
        ...overrides,
    };
}

describe('toCollectorHealth', () => {
    it('is disabled when the collector is off, whatever the history says', () => {
        const health = toCollectorHealth(false, { latest: run({ parse_errors: 3 }), lastSuccessAt: null }, NOW);

        expect(health.status).toBe('disabled');
        expect(health.lastRun?.parseErrors).toBe(3);
    });

    it('is ok after a clean recent cycle and shows that cycle', () => {
        const health = toCollectorHealth(true, { latest: run(), lastSuccessAt: new Date(NOW - 30_000) }, NOW);

        expect(health).toEqual({
            status: 'ok',
            lastRun: {
                status: 'success',
                startedAt: new Date(NOW - 60_000).toISOString(),
                finishedAt: new Date(NOW - 30_000).toISOString(),
                requests: 24,
                parseErrors: 0,
                fetchErrors: 0,
                error: null,
            },
            lastSuccessAt: new Date(NOW - 30_000).toISOString(),
        });
    });

    it('is ok right after boot, before the first cycle has run', () => {
        expect(toCollectorHealth(true, { latest: null, lastSuccessAt: null }, NOW).status).toBe('ok');
    });

    it('is degraded when the latest cycle had parse errors, even though it is recent', () => {
        const health = toCollectorHealth(true, { latest: run({ status: 'partial', parse_errors: 2 }), lastSuccessAt: new Date(NOW - 30_000) }, NOW);

        expect(health.status).toBe('degraded');
    });

    it('is degraded when the last success is older than two intervals, and ok just inside', () => {
        const stale = new Date(NOW - STALE_AFTER_MS - 1);
        const fresh = new Date(NOW - STALE_AFTER_MS + 1);

        expect(toCollectorHealth(true, { latest: run({ status: 'failed' }), lastSuccessAt: stale }, NOW).status).toBe('degraded');
        expect(toCollectorHealth(true, { latest: run({ status: 'failed' }), lastSuccessAt: fresh }, NOW).status).toBe('ok');
    });

    it('is degraded when cycles ran but none ever succeeded, or when the history cannot be read', () => {
        expect(toCollectorHealth(true, { latest: run({ status: 'failed' }), lastSuccessAt: null }, NOW).status).toBe('degraded');
        expect(toCollectorHealth(true, null, NOW).status).toBe('degraded');
    });

    it('reports disabled without a history too', () => {
        expect(toCollectorHealth(false, null, NOW)).toEqual({ status: 'disabled', lastRun: null, lastSuccessAt: null });
    });
});
