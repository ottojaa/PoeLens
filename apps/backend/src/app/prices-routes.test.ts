import {
    HistoryResponseSchema,
    LatestResponseSchema,
    LeaguesResponseSchema,
    MoversResponseSchema,
    SearchResponseSchema,
    TableResponseSchema,
} from '@poelens/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCycle } from '../collector/runtime.js';
import { createPoeNinjaPoe2Adapter } from '../collector/sources/poe-ninja/poe2.js';
import { createPgCollectorStore } from '../collector/store-pg.js';
import { bearer, seedUser, signIn } from '../testing/auth-helpers.js';
import { buildTestApp } from '../testing/build-app.js';
import { FakeNinja } from '../testing/fake-ninja.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../testing/test-database.js';

// The routes need a signed-in user: the refusal without one is covered in prices-access.test.ts.
describe.skipIf(SKIP_DB_TESTS)('price routes for a signed-in user', () => {
    let test: TestDatabase;
    let server: Awaited<ReturnType<typeof buildTestApp>>;
    let accessToken: string;

    beforeAll(async () => {
        test = await createTestDatabase();
        await runCycle({
            adapter: createPoeNinjaPoe2Adapter({ leagues: ['Forbidden Rites'] }),
            store: createPgCollectorStore(test.db),
            fetcher: new FakeNinja(),
            now: () => new Date(),
        });
        process.env.DATABASE_URL = test.url;
        server = await buildTestApp();
        await seedUser(test.db, { email: 'reader@example.com' });
        accessToken = (await signIn(server, 'reader@example.com')).accessToken;
    });

    afterAll(async () => {
        await server.close();
        await test.close();
    });

    async function get(url: string) {
        const res = await server.inject({ method: 'GET', url, headers: bearer(accessToken) });

        return { status: res.statusCode, body: res.json() };
    }

    it('answers the Currency table with its envelope', async () => {
        const { status, body } = await get('/prices/table?game=poe2&category=Currency');
        const parsed = TableResponseSchema.parse(body);

        expect(status).toBe(200);
        expect(parsed).toMatchObject({ game: 'poe2', league: { name: 'Forbidden Rites', current: true }, unit: 'exalted' });
        expect(parsed.rows).toHaveLength(11);
        expect(parsed.rows[0]).toMatchObject({
            unit: 'exalted',
            prices: { divine: expect.any(Number), exalted: expect.any(Number), chaos: expect.any(Number) },
        });
    });

    it('answers Auto with each row in its own unit', async () => {
        const parsed = TableResponseSchema.parse((await get('/prices/table?game=poe2&category=Currency&unit=auto&sparkline=true')).body);

        expect(parsed.unit).toBe('auto');
        expect(new Set(parsed.rows.map((row) => row.unit))).toEqual(new Set(['divine', 'chaos', 'exalted']));
        expect((await get('/prices/movers?game=poe2&unit=auto')).status).toBe(400);
    });

    it('adds a sparkline to each row only when asked, and the response schema does not strip it', async () => {
        const plain = (await get('/prices/table?game=poe2&category=Currency')).body as { rows: object[] };
        const withLines = (await get('/prices/table?game=poe2&category=Currency&sparkline=true')).body as { rows: { sparkline?: number[] }[] };

        expect(plain.rows.every((row) => !('sparkline' in row))).toBe(true);
        expect(withLines.rows.every((row) => Array.isArray(row.sparkline))).toBe(true);
        expect(withLines.rows.some((row) => (row.sparkline?.length ?? 0) > 0)).toBe(true);
    });

    it('answers latest, history, movers, search and leagues', async () => {
        const table = TableResponseSchema.parse((await get('/prices/table?game=poe2&category=Currency')).body);
        const divine = table.rows.find((row) => row.item.name === 'Divine Orb');
        const id = divine?.item.id ?? 0;

        expect(LatestResponseSchema.parse((await get(`/prices/latest?game=poe2&items=${id},999999`)).body).unlisted).toEqual([999999]);
        expect(HistoryResponseSchema.parse((await get(`/prices/history?game=poe2&item=${id}&bucket=day`)).body).points).toHaveLength(1);
        expect(MoversResponseSchema.parse((await get('/prices/movers?game=poe2')).body).window).toBe('24h');
        expect(SearchResponseSchema.parse((await get('/prices/search?game=poe2&q=divne')).body).results[0]?.item.name).toBe('Divine Orb');
        expect(LeaguesResponseSchema.parse((await get('/prices/leagues?game=poe2')).body).leagues[0]?.name).toBe('Forbidden Rites');
    });

    it('answers a bad query with 400 and an unknown league or item with 404', async () => {
        expect((await get('/prices/table?game=poe2')).status).toBe(400);
        expect((await get('/prices/table?game=poe2&category=Currency&league=Nowhere')).status).toBe(404);
        expect((await get('/prices/history?game=poe2&item=999999')).status).toBe(404);
        expect((await get('/prices/history?game=poe2&item=1&bucket=hour&from=2026-01-01T00:00:00.000Z')).status).toBe(400);
    });
});
