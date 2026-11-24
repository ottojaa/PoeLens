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

const ID = '6b1c7a52-3f0e-4c84-9d3a-1e5f2b7a9c40';
const DASHBOARD_ROUTES = [
    { method: 'GET', url: '/dashboards?game=poe2' },
    { method: 'POST', url: '/dashboards' },
    { method: 'PUT', url: '/dashboards/order' },
    { method: 'POST', url: '/dashboards/data' },
    { method: 'PUT', url: `/dashboards/${ID}` },
    { method: 'DELETE', url: `/dashboards/${ID}` },
] as const;

describe('dashboard routes without a session', () => {
    it.each(DASHBOARD_ROUTES)('answer 401 to $method $url', async ({ method, url }) => {
        const res = await server.inject({ method, url });

        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ statusCode: 401, error: 'TOKEN_INVALID' });
    });

    it('refuse a request before validating it', async () => {
        const res = await server.inject({ method: 'PUT', url: '/dashboards/not-a-uuid', payload: { nonsense: true } });

        expect(res.statusCode).toBe(401);
    });
});
