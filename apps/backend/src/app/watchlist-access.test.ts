import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildTestApp } from '../testing/build-app.js';

// The built app reads its env once, on first load: set production before anything loads it. Nothing listens on port 1, so
// a request that got past the access hook would fail on the database instead of answering 401.
vi.stubEnv('NODE_ENV', 'production');
process.env.DATABASE_URL = 'postgres://nobody:nobody@127.0.0.1:1/none';
process.env.JWT_SECRET = 'a-production-test-secret-of-at-least-32-chars';

let server: Awaited<ReturnType<typeof buildTestApp>>;

beforeAll(async () => {
    server = await buildTestApp();
});

afterAll(async () => {
    await server.close();
});

const WATCHLIST_ROUTES = [
    { method: 'GET', url: '/watchlist?game=poe2' },
    { method: 'PUT', url: '/watchlist/1' },
    { method: 'DELETE', url: '/watchlist/1' },
] as const;

describe('watchlist routes without a session', () => {
    it.each(WATCHLIST_ROUTES)('answer 401 to $method $url', async ({ method, url }) => {
        const res = await server.inject({ method, url });

        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ statusCode: 401, error: 'TOKEN_INVALID' });
    });

    it('refuse a request before validating it', async () => {
        const res = await server.inject({ method: 'PUT', url: '/watchlist/not-a-number' });

        expect(res.statusCode).toBe(401);
    });
});
