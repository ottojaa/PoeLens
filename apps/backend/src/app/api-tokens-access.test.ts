import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildTestApp } from '../testing/build-app.js';

// The built app reads its env once, on first load: set production before anything loads it. Nothing listens on port 1, so
// a request that got past the access hooks would fail on the database instead of answering 401.
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

describe('token routes without a session', () => {
    it.each([
        { method: 'GET', url: '/api-tokens' },
        { method: 'POST', url: '/api-tokens' },
        { method: 'DELETE', url: '/api-tokens/6f9619ff-8b86-d011-b42d-00c04fc964ff' },
    ] as const)('answer 401 to $method $url', async ({ method, url }) => {
        const res = await server.inject({ method, url });

        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ statusCode: 401, error: 'TOKEN_INVALID' });
    });
});

describe('/mcp without a well-shaped API token', () => {
    const NOT_TOKENS = [
        undefined,
        '',
        'Bearer',
        'Bearer pl_short',
        'Bearer ' + 'a'.repeat(46),
        'Basic cGxfeA==',
        'Bearer pl_' + 'A'.repeat(43) + 'x',
        // The shape of a session JWT.
        'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl',
    ];

    it.each(NOT_TOKENS)('answers 401 with a challenge, before any database call, to %j', async (authorization) => {
        const res = await server.inject({
            method: 'POST',
            url: '/mcp',
            headers: authorization === undefined ? {} : { authorization },
            payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        });

        expect(res.statusCode).toBe(401);
        expect(res.headers['www-authenticate']).toBe('Bearer');
        expect(res.json()).toMatchObject({ statusCode: 401 });
        expect(res.body).not.toContain('pl_');
    });

    it('refuses before it validates the body', async () => {
        const res = await server.inject({ method: 'POST', url: '/mcp', payload: 'not json at all', headers: { 'content-type': 'application/json' } });

        expect(res.statusCode).toBe(401);
    });
});
