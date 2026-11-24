import { MAX_WATCHLIST_ITEMS, WatchlistResponseSchema } from '@poelens/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCycle } from '../collector/runtime.js';
import { createPoeNinjaPoe2Adapter } from '../collector/sources/poe-ninja/poe2.js';
import { createPgCollectorStore } from '../collector/store-pg.js';
import { bearer, seedUser, signIn } from '../testing/auth-helpers.js';
import { buildTestApp } from '../testing/build-app.js';
import { FakeNinja } from '../testing/fake-ninja.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../testing/test-database.js';

// The refusal without a session is covered in watchlist-access.test.ts.
describe.skipIf(SKIP_DB_TESTS)('watchlist routes for signed-in users', () => {
    let test: TestDatabase;
    let server: Awaited<ReturnType<typeof buildTestApp>>;
    let aliceToken: string;
    let aliceId: string;
    let bobToken: string;
    let divine: number;

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
        const alice = await signIn(server, 'alice@example.com');

        aliceToken = alice.accessToken;
        aliceId = alice.userId;
        bobToken = (await signIn(server, 'bob@example.com')).accessToken;
        divine = (await test.db.selectFrom('items').select('id').where('name', '=', 'Divine Orb').executeTakeFirstOrThrow()).id;
    });

    afterAll(async () => {
        await server.close();
        await test.close();
    });

    const call = (method: 'GET' | 'PUT' | 'DELETE', url: string, token: string) => server.inject({ method, url, headers: bearer(token) });

    it('watches idempotently, lists with the response schema, and unwatches idempotently', async () => {
        expect((await call('PUT', `/watchlist/${divine}`, aliceToken)).statusCode).toBe(204);
        expect((await call('PUT', `/watchlist/${divine}`, aliceToken)).statusCode).toBe(204);

        const listed = await call('GET', '/watchlist?game=poe2', aliceToken);
        const body = WatchlistResponseSchema.parse(listed.json());

        expect(listed.statusCode).toBe(200);
        expect(body.rows.map((row) => row.item.name)).toEqual(['Divine Orb']);
        expect(body.rows[0]?.sparkline).toBeDefined();

        expect((await call('DELETE', `/watchlist/${divine}`, aliceToken)).statusCode).toBe(204);
        expect((await call('DELETE', `/watchlist/${divine}`, aliceToken)).statusCode).toBe(204);
        expect(WatchlistResponseSchema.parse((await call('GET', '/watchlist?game=poe2', aliceToken)).json()).rows).toEqual([]);
    });

    it("never shows one user the other's list", async () => {
        await call('PUT', `/watchlist/${divine}`, aliceToken);

        const bobs = WatchlistResponseSchema.parse((await call('GET', '/watchlist?game=poe2', bobToken)).json());

        expect(bobs).toMatchObject({ rows: [], unlisted: [] });
        await call('DELETE', `/watchlist/${divine}`, bobToken);
        expect(WatchlistResponseSchema.parse((await call('GET', '/watchlist?game=poe2', aliceToken)).json()).rows).toHaveLength(1);
        await call('DELETE', `/watchlist/${divine}`, aliceToken);
    });

    it('answers an unknown item with 404, and a malformed or oversized id with 400', async () => {
        expect((await call('PUT', '/watchlist/999999', aliceToken)).statusCode).toBe(404);
        expect((await call('PUT', '/watchlist/abc', aliceToken)).statusCode).toBe(400);
        expect((await call('PUT', '/watchlist/99999999999', aliceToken)).statusCode).toBe(400);
        expect((await call('PUT', '/watchlist/0', aliceToken)).statusCode).toBe(400);
    });

    it('answers a full list with 409 WATCHLIST_FULL, but a watched item again with 204', async () => {
        const fillers = await test.db
            .insertInto('items')
            .values(Array.from({ length: MAX_WATCHLIST_ITEMS }, (_, index) => ({ game: 'poe2', name: `Filler ${index}`, category: 'Filler' })))
            .returning('id')
            .execute();

        await test.db
            .insertInto('watchlist_items')
            .values(fillers.map((filler) => ({ user_id: aliceId, item_id: filler.id })))
            .execute();

        const refused = await call('PUT', `/watchlist/${divine}`, aliceToken);

        expect(refused.statusCode).toBe(409);
        expect(refused.json()).toMatchObject({ statusCode: 409, error: 'WATCHLIST_FULL' });
        expect((await call('PUT', `/watchlist/${fillers[0]?.id}`, aliceToken)).statusCode).toBe(204);
        expect((await call('DELETE', `/watchlist/${fillers[0]?.id}`, aliceToken)).statusCode).toBe(204);
        expect((await call('PUT', `/watchlist/${divine}`, aliceToken)).statusCode).toBe(204);
    });
});
