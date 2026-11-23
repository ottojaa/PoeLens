import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildTestApp } from '../testing/build-app.js';

// The built app reads its env once, on first load: set production before anything loads it. Nothing listens on port 1, so
// a request that got past the access hook would fail on the database instead of answering 403.
vi.stubEnv('NODE_ENV', 'production');
process.env.DATABASE_URL = 'postgres://nobody:nobody@127.0.0.1:1/none';

let server: Awaited<ReturnType<typeof buildTestApp>>;

beforeAll(async () => {
    server = await buildTestApp();
});

afterAll(async () => {
    await server.close();
});

const PRICE_ROUTES = [
    '/prices/table?game=poe2&category=Currency',
    '/prices/latest?game=poe2&items=1,2',
    '/prices/history?game=poe2&item=1',
    '/prices/movers?game=poe2',
    '/prices/search?game=poe2&q=divine',
    '/prices/leagues?game=poe2',
];

describe('price routes in production', () => {
    it.each(PRICE_ROUTES)('refuse GET %s', async (url) => {
        const res = await server.inject({ method: 'GET', url });

        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ statusCode: 403, error: 'FORBIDDEN' });
    });

    it('refuse a request before validating it', async () => {
        const res = await server.inject({ method: 'GET', url: '/prices/table' });

        expect(res.statusCode).toBe(403);
    });

    it('leave /health open', async () => {
        const res = await server.inject({ method: 'GET', url: '/health' });

        expect(res.statusCode).toBe(200);
    });
});
