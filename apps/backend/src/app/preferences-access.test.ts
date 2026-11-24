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

describe('preferences routes without a session', () => {
    it.each([
        { method: 'GET', url: '/me/preferences' },
        { method: 'PATCH', url: '/me/preferences' },
    ] as const)('answer 401 to $method $url', async ({ method, url }) => {
        const res = await server.inject({ method, url });

        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ statusCode: 401, error: 'TOKEN_INVALID' });
    });

    it('refuse a request before validating it', async () => {
        const res = await server.inject({ method: 'PATCH', url: '/me/preferences', payload: { theme: 'gold' } });

        expect(res.statusCode).toBe(401);
    });

    it('refuse an API token, which is not a session', async () => {
        const res = await server.inject({ method: 'GET', url: '/me/preferences', headers: { authorization: 'Bearer pl_' + 'A'.repeat(43) } });

        expect(res.statusCode).toBe(401);
    });
});
