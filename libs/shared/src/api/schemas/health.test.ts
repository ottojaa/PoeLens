import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './health.js';

const healthy = {
    status: 'ok',
    timestamp: '2026-12-11T18:00:00.000Z',
    version: '0.0.1',
    uptime: 12,
    services: { database: 'ok' },
};

describe('HealthResponseSchema', () => {
    it('accepts ok and degraded responses', () => {
        expect(HealthResponseSchema.safeParse(healthy).success).toBe(true);
        expect(HealthResponseSchema.safeParse({ ...healthy, status: 'degraded', services: { database: 'down' } }).success).toBe(true);
    });

    it.each([
        ['an unknown status', { ...healthy, status: 'fine' }],
        ['a missing database field', { ...healthy, services: {} }],
        ['a non-date timestamp', { ...healthy, timestamp: 'yesterday' }],
    ])('rejects %s', (_name, body) => {
        expect(HealthResponseSchema.safeParse(body).success).toBe(false);
    });
});
