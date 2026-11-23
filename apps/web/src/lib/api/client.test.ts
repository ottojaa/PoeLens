import { HealthResponseSchema } from '@poelens/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from './client';

const validHealth = {
    status: 'degraded',
    timestamp: '2026-12-11T18:00:00.000Z',
    version: '0.0.1',
    uptime: 3,
    services: { database: 'down' },
};

function respondWith(body: unknown, init?: { status?: number }) {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200, ...init }));

    vi.stubGlobal('fetch', fetchMock);

    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('fetchApi', () => {
    it('returns a body that satisfies the schema', async () => {
        const fetchMock = respondWith(validHealth);

        await expect(fetchApi('/health', HealthResponseSchema)).resolves.toEqual(validHealth);
        expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/health$/);
    });

    it('rejects a response that fails the schema', async () => {
        respondWith({ ...validHealth, services: {} });

        await expect(fetchApi('/health', HealthResponseSchema)).rejects.toThrow();
    });

    it('rejects a non-2xx response before parsing it', async () => {
        respondWith(validHealth, { status: 503 });

        await expect(fetchApi('/health', HealthResponseSchema)).rejects.toThrow('API request failed: 503 /health');
    });
});
