import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './health.js';

const disabledCollector = { status: 'disabled', lastRun: null, lastSuccessAt: null };

const healthy = {
    status: 'ok',
    timestamp: '2026-12-11T18:00:00.000Z',
    version: '0.0.1',
    uptime: 12,
    services: { database: 'ok', collector: disabledCollector },
};

describe('HealthResponseSchema', () => {
    it('accepts ok and degraded responses', () => {
        expect(HealthResponseSchema.safeParse(healthy).success).toBe(true);
        expect(HealthResponseSchema.safeParse({ ...healthy, status: 'degraded', services: { database: 'down', collector: disabledCollector } }).success).toBe(
            true,
        );
    });

    it('accepts a collector that reports its last cycle', () => {
        const collector = {
            status: 'degraded',
            lastRun: {
                status: 'partial',
                startedAt: '2026-12-11T17:45:00.000Z',
                finishedAt: '2026-12-11T17:46:10.000Z',
                requests: 24,
                parseErrors: 1,
                fetchErrors: 0,
                error: null,
            },
            lastSuccessAt: '2026-12-11T17:46:10.000Z',
        };

        expect(HealthResponseSchema.safeParse({ ...healthy, services: { database: 'ok', collector } }).success).toBe(true);
    });

    it.each([
        ['an unknown status', { ...healthy, status: 'fine' }],
        ['a missing database field', { ...healthy, services: { collector: disabledCollector } }],
        ['a missing collector field', { ...healthy, services: { database: 'ok' } }],
        ['an unknown collector status', { ...healthy, services: { database: 'ok', collector: { ...disabledCollector, status: 'maybe' } } }],
        ['a non-date timestamp', { ...healthy, timestamp: 'yesterday' }],
    ])('rejects %s', (_name, body) => {
        expect(HealthResponseSchema.safeParse(body).success).toBe(false);
    });
});
