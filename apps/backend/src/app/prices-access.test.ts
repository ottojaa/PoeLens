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

const PRICE_ROUTES = [
    '/prices/table?game=poe2&category=Currency',
    '/prices/latest?game=poe2&items=1,2',
    '/prices/history?game=poe2&item=1',
    '/prices/movers?game=poe2',
    '/prices/search?game=poe2&q=divine',
    '/prices/leagues?game=poe2',
];

describe('price routes without a session', () => {
    it.each(PRICE_ROUTES)('answer 401 to GET %s', async (url) => {
        const res = await server.inject({ method: 'GET', url });

        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ statusCode: 401, error: 'TOKEN_INVALID' });
    });

    it('refuse a request before validating it', async () => {
        const res = await server.inject({ method: 'GET', url: '/prices/table' });

        expect(res.statusCode).toBe(401);
    });

    it('refuse a token signed with another secret, and a refresh-token-shaped value', async () => {
        const foreign = server.jwt.sign({ sub: 'x', email: 'x@example.com' });
        const wrongSecret = foreign.slice(0, -4) + 'AAAA';

        for (const token of [wrongSecret, 'x'.repeat(43)]) {
            const res = await server.inject({ method: 'GET', url: '/prices/leagues?game=poe2', headers: { authorization: 'Bearer ' + token } });

            expect(res.statusCode).toBe(401);
        }
    });

    it('let a valid access token through to the handler', async () => {
        const token = server.jwt.sign({ sub: 'user-1', email: 'a@example.com' });
        const res = await server.inject({ method: 'GET', url: '/prices/leagues?game=poe2', headers: { authorization: 'Bearer ' + token } });

        // The database is unreachable here, so getting past authentication shows as a server error, not a 401.
        expect(res.statusCode).toBe(500);
    });

    it('leave /health and /docs open', async () => {
        expect((await server.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
        expect((await server.inject({ method: 'GET', url: '/docs' })).statusCode).not.toBe(401);
    });
});
