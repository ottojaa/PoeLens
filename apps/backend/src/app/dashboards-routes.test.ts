import { DashboardDataResponseSchema, DashboardSchema, DashboardsResponseSchema, MAX_DASHBOARDS } from '@poelens/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCycle } from '../collector/runtime.js';
import { createPoeNinjaPoe2Adapter } from '../collector/sources/poe-ninja/poe2.js';
import { createPgCollectorStore } from '../collector/store-pg.js';
import { bearer, seedUser, signIn } from '../testing/auth-helpers.js';
import { buildTestApp } from '../testing/build-app.js';
import { FakeNinja } from '../testing/fake-ninja.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../testing/test-database.js';

// The refusal without a session is covered in dashboards-access.test.ts.
describe.skipIf(SKIP_DB_TESTS)('dashboard routes for signed-in users', () => {
    let test: TestDatabase;
    let server: Awaited<ReturnType<typeof buildTestApp>>;
    let aliceToken: string;
    let bobToken: string;
    let divine: number;
    let exalted: number;

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
        await seedUser(test.db, { email: 'alice@example.com' });
        await seedUser(test.db, { email: 'bob@example.com' });
        aliceToken = (await signIn(server, 'alice@example.com')).accessToken;
        bobToken = (await signIn(server, 'bob@example.com')).accessToken;

        const idOf = async (name: string) => (await test.db.selectFrom('items').select('id').where('name', '=', name).executeTakeFirstOrThrow()).id;

        divine = await idOf('Divine Orb');
        exalted = await idOf('Exalted Orb');
    });

    afterAll(async () => {
        await server.close();
        await test.close();
    });

    const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, token: string, payload?: object) =>
        server.inject({ method, url, headers: bearer(token), ...(payload && { payload }) });

    it('lists the starter, saves it, and answers a stale second save with 409 and the stored dashboard', async () => {
        const listed = await call('GET', '/dashboards?game=poe2', aliceToken);
        const { dashboards, max } = DashboardsResponseSchema.parse(listed.json());
        const starter = dashboards[0]!;

        expect(listed.statusCode).toBe(200);
        expect(max).toBe(MAX_DASHBOARDS);
        expect(starter).toMatchObject({ name: 'Trading', revision: 0 });

        const saved = await call('PUT', `/dashboards/${starter.id}`, aliceToken, { revision: 0, name: 'Trading', panels: starter.panels });

        expect(saved.statusCode).toBe(200);
        expect(DashboardSchema.parse(saved.json()).revision).toBe(1);

        const stale = await call('PUT', `/dashboards/${starter.id}`, aliceToken, { revision: 0, name: 'Mine', panels: [] });

        expect(stale.statusCode).toBe(409);
        expect(stale.json()).toMatchObject({ error: 'DASHBOARD_CHANGED', details: { current: { id: starter.id, revision: 1, name: 'Trading' } } });
    });

    it('adds, reorders and deletes tabs, and keeps them to their owner', async () => {
        const created = await call('POST', '/dashboards', aliceToken, { game: 'poe2', name: 'Leveling' });
        const tab = DashboardSchema.parse(created.json());

        expect(created.statusCode).toBe(201);
        expect(tab).toMatchObject({ name: 'Leveling', position: 1, revision: 1 });

        const starter = DashboardsResponseSchema.parse((await call('GET', '/dashboards?game=poe2', aliceToken)).json()).dashboards[0]!;

        expect((await call('PUT', '/dashboards/order', aliceToken, { game: 'poe2', ids: [tab.id, starter.id] })).statusCode).toBe(204);
        expect(DashboardsResponseSchema.parse((await call('GET', '/dashboards?game=poe2', aliceToken)).json()).dashboards.map((d) => d.name)).toEqual([
            'Leveling',
            'Trading',
        ]);

        expect((await call('PUT', `/dashboards/${tab.id}`, bobToken, { revision: 1, name: 'Mine', panels: [] })).statusCode).toBe(404);
        expect((await call('DELETE', `/dashboards/${tab.id}`, bobToken)).statusCode).toBe(404);
        expect((await call('DELETE', `/dashboards/${tab.id}`, aliceToken)).statusCode).toBe(204);
    });

    it('refuses the eleventh dashboard with 409 DASHBOARDS_FULL', async () => {
        for (let count = 0; count < MAX_DASHBOARDS; count += 1) await call('POST', '/dashboards', bobToken, { game: 'poe2', name: 'Tab ' + count });

        const full = await call('POST', '/dashboards', bobToken, { game: 'poe2', name: 'One too many' });

        expect(full.statusCode).toBe(409);
        expect(full.json()).toMatchObject({ error: 'DASHBOARDS_FULL', details: { limit: MAX_DASHBOARDS } });
    });

    it('refuses a body that is not a dashboard, and an item the game does not have', async () => {
        const starter = DashboardsResponseSchema.parse((await call('GET', '/dashboards?game=poe2', aliceToken)).json()).dashboards[0]!;
        const bad = await call('PUT', `/dashboards/${starter.id}`, aliceToken, { revision: 1, name: '', panels: [] });
        const block = { id: 'b1', v: 1, type: 'item', item: 2_000_000, display: 'compact' };
        const unknown = await call('PUT', `/dashboards/${starter.id}`, aliceToken, {
            revision: 1,
            name: 'Trading',
            panels: [{ id: 'p1', title: 'P', x: 0, y: 0, w: 4, h: 6, hideOnPhone: false, unit: null, blocks: [block] }],
        });

        expect(bad.statusCode).toBe(400);
        expect(unknown.statusCode).toBe(400);
    });

    it('answers data by block id, with the response schema', async () => {
        const res = await call('POST', '/dashboards/data', aliceToken, {
            game: 'poe2',
            panels: [
                {
                    unit: null,
                    blocks: [
                        { id: 'i', type: 'item', item: divine },
                        { id: 'p', type: 'pair', a: divine, b: exalted },
                    ],
                },
            ],
        });
        const body = DashboardDataResponseSchema.parse(res.json());

        expect(res.statusCode).toBe(200);
        expect(Object.keys(body.blocks).sort()).toEqual(['i', 'p']);
        expect(body.blocks['p']).toMatchObject({ type: 'pair' });
    });
});
