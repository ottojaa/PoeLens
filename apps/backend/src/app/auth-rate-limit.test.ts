import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../testing/build-app.js';

// Nothing listens on port 1: login fails on the database lookup, which still counts against the limit. The limit is
// checked before the handler runs, so the 31st request is answered 429 without touching the database.
process.env.DATABASE_URL = 'postgres://nobody:nobody@127.0.0.1:1/none';

let server: Awaited<ReturnType<typeof buildTestApp>>;

beforeAll(async () => {
    server = await buildTestApp();
});

afterAll(async () => {
    await server.close();
});

async function attempts(count: number, forwardedFor: (index: number) => string): Promise<number[]> {
    const statuses: number[] = [];

    for (let index = 0; index < count; index += 1) {
        const res = await server.inject({
            method: 'POST',
            url: '/auth/login',
            headers: { 'x-forwarded-for': forwardedFor(index) },
            payload: { email: 'someone@example.com', password: 'whatever password' },
        });

        statuses.push(res.statusCode);
    }

    return statuses;
}

describe('login rate limit and X-Forwarded-For', () => {
    it('keys on the rightmost entry: a client cannot dodge the limit by faking leading entries', async () => {
        const statuses = await attempts(35, (index) => `198.51.100.${index}, 203.0.113.7`);

        expect(statuses.slice(30)).toEqual([429, 429, 429, 429, 429]);
        expect(statuses.slice(0, 30)).not.toContain(429);
    });

    it('does not share a bucket between clients that differ in the rightmost entry', async () => {
        const statuses = await attempts(35, (index) => `198.51.100.1, 192.0.2.${index + 1}`);

        expect(statuses).not.toContain(429);
    });
});
