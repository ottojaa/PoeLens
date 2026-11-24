import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, freshIp, seedUser, signIn } from '../testing/auth-helpers.js';
import { buildTestApp } from '../testing/build-app.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../testing/test-database.js';

// The refusal without a session is covered in preferences-access.test.ts.
describe.skipIf(SKIP_DB_TESTS)('preferences routes for signed-in users', () => {
    let test: TestDatabase;
    let server: Awaited<ReturnType<typeof buildTestApp>>;

    beforeAll(async () => {
        test = await createTestDatabase();
        process.env.DATABASE_URL = test.url;
        server = await buildTestApp();
    });

    afterAll(async () => {
        await server.close();
        await test.close();
    });

    /** A fresh member with a session, so no test shares preferences with another. */
    async function member(name: string) {
        const email = `${name}@example.com`;
        const userId = await seedUser(test.db, { email });

        return { userId, email, session: await signIn(server, email) };
    }

    const get = (accessToken: string) => server.inject({ method: 'GET', url: '/me/preferences', headers: bearer(accessToken) });
    const patch = (accessToken: string, payload: unknown) =>
        server.inject({ method: 'PATCH', url: '/me/preferences', headers: bearer(accessToken), payload: payload as object });

    it('answers a new user with no preferences', async () => {
        const { session } = await member('fresh');
        const res = await get(session.accessToken);

        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({});
    });

    it('saves a choice and gives it back on the next read, on another session', async () => {
        const { email, session } = await member('saver');
        const saved = await patch(session.accessToken, { theme: 'slate', unit: 'divine' });

        expect(saved.statusCode).toBe(200);
        expect(saved.json()).toEqual({ theme: 'slate', unit: 'divine' });

        const elsewhere = await signIn(server, email);

        expect((await get(elsewhere.accessToken)).json()).toEqual({ theme: 'slate', unit: 'divine' });
    });

    it('merges: a key left out is unchanged, a key given is replaced', async () => {
        const { session } = await member('merger');

        await patch(session.accessToken, { theme: 'graphite', mode: 'light' });

        const res = await patch(session.accessToken, { mode: 'system' });

        expect(res.json()).toEqual({ theme: 'graphite', mode: 'system' });
        expect((await patch(session.accessToken, {})).json()).toEqual({ theme: 'graphite', mode: 'system' });
    });

    it('keeps both keys when two updates of different keys arrive together', async () => {
        const { session } = await member('racer');

        await Promise.all([
            patch(session.accessToken, { theme: 'slate' }),
            patch(session.accessToken, { unit: 'chaos' }),
            patch(session.accessToken, { mode: 'light' }),
        ]);

        expect((await get(session.accessToken)).json()).toEqual({ theme: 'slate', unit: 'chaos', mode: 'light' });
    });

    it.each([{ theme: 'gold' }, { mode: 'auto' }, { unit: 'mirror' }, { theme: 7 }])('refuses %j with 400 and saves nothing', async (body) => {
        const { session } = await member('strict' + Math.random().toString(36).slice(2, 8));

        await patch(session.accessToken, { mode: 'dark' });

        const res = await patch(session.accessToken, body);

        expect(res.statusCode).toBe(400);
        expect((await get(session.accessToken)).json()).toEqual({ mode: 'dark' });
    });

    it('ignores keys it does not know', async () => {
        const { session } = await member('unknownkeys');
        const res = await patch(session.accessToken, { theme: 'slate', role: 'admin', fontSize: 40 });

        expect(res.json()).toEqual({ theme: 'slate' });
    });

    it('drops stored values that are no longer valid when reading, without an error', async () => {
        const { userId, session } = await member('stale');

        await test.db
            .updateTable('users')
            .set({ preferences: JSON.stringify({ theme: 'gold', mode: 'light', unit: 'mirror', extra: true }) })
            .where('id', '=', userId)
            .execute();

        const res = await get(session.accessToken);

        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ mode: 'light' });
        expect((await patch(session.accessToken, { theme: 'slate' })).json()).toEqual({ mode: 'light', theme: 'slate' });
    });

    it('keeps one user from reading or changing another', async () => {
        const alice = await member('alice');
        const bob = await member('bob');

        await patch(alice.session.accessToken, { theme: 'slate' });
        await patch(bob.session.accessToken, { theme: 'graphite' });

        expect((await get(alice.session.accessToken)).json()).toEqual({ theme: 'slate' });
        expect((await get(bob.session.accessToken)).json()).toEqual({ theme: 'graphite' });
    });

    it('does not move users.updated_at, so a theme click never refuses a new API token', async () => {
        const { userId, session } = await member('tokens');
        const before = await test.db.selectFrom('users').select('updated_at').where('id', '=', userId).executeTakeFirstOrThrow();

        await patch(session.accessToken, { theme: 'slate' });

        const after = await test.db.selectFrom('users').select('updated_at').where('id', '=', userId).executeTakeFirstOrThrow();
        const token = await server.inject({
            method: 'POST',
            url: '/api-tokens',
            headers: { ...bearer(session.accessToken), 'x-forwarded-for': freshIp() },
            payload: { name: 'Claude Code' },
        });

        expect(after.updated_at).toEqual(before.updated_at);
        expect(token.statusCode).toBe(201);
    });
});
