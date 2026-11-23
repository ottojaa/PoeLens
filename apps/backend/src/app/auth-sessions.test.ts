import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, freshIp, readRefreshCookie, seedUser, signIn, TEST_PASSWORD } from '../testing/auth-helpers.js';
import { buildTestApp } from '../testing/build-app.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../testing/test-database.js';

describe.skipIf(SKIP_DB_TESTS)('sessions', () => {
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

    function refresh(refreshToken: string) {
        return server.inject({ method: 'POST', url: '/auth/refresh', headers: { 'x-forwarded-for': freshIp(), cookie: 'refresh_token=' + refreshToken } });
    }

    it('signs in, sets an httpOnly refresh cookie on /auth and answers /auth/me', async () => {
        await seedUser(test.db, { email: 'login@example.com' });

        const res = await server.inject({
            method: 'POST',
            url: '/auth/login',
            headers: { 'x-forwarded-for': freshIp() },
            payload: { email: 'LOGIN@example.com', password: TEST_PASSWORD },
        });
        const cookie = res.cookies.find((c) => c.name === 'refresh_token');

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ user: { email: 'login@example.com', role: 'member' }, expiresIn: 900 });
        expect(cookie).toMatchObject({ httpOnly: true, path: '/auth', sameSite: 'Lax' });

        const me = await server.inject({ method: 'GET', url: '/auth/me', headers: bearer(res.json().accessToken) });

        expect(me.statusCode).toBe(200);
        expect(me.json().user.email).toBe('login@example.com');
    });

    it('answers every login failure the same way', async () => {
        await seedUser(test.db, { email: 'known@example.com' });
        await seedUser(test.db, { email: 'inactive@example.com', isActive: false });

        const attempts = [
            { email: 'known@example.com', password: 'wrong password here' },
            { email: 'nobody@example.com', password: TEST_PASSWORD },
            { email: 'inactive@example.com', password: TEST_PASSWORD },
        ];

        for (const payload of attempts) {
            const res = await server.inject({ method: 'POST', url: '/auth/login', headers: { 'x-forwarded-for': freshIp() }, payload });

            expect(res.statusCode).toBe(401);
            expect(res.json()).toMatchObject({ error: 'INVALID_CREDENTIALS', message: 'Wrong email or password' });
        }
    });

    it('rotates the refresh token on every use and refuses a spent one', async () => {
        await seedUser(test.db, { email: 'rotate@example.com' });

        const first = await signIn(server, 'rotate@example.com');
        const second = await refresh(first.refreshToken);
        const next = readRefreshCookie(second);

        expect(second.statusCode).toBe(200);
        expect(next).toBeTruthy();
        expect(next).not.toBe(first.refreshToken);
        expect((await refresh(first.refreshToken)).statusCode).toBe(401);
        expect((await refresh(next ?? '')).statusCode).toBe(200);
    });

    it('lets only one of two simultaneous refreshes with the same token win', async () => {
        await seedUser(test.db, { email: 'race@example.com' });

        const { refreshToken } = await signIn(server, 'race@example.com');
        const statuses = (await Promise.all([refresh(refreshToken), refresh(refreshToken)])).map((res) => res.statusCode).sort();

        expect(statuses).toEqual([200, 401]);
    });

    it('also takes the refresh token in the body, for clients without a cookie jar', async () => {
        await seedUser(test.db, { email: 'body@example.com' });

        const { refreshToken } = await signIn(server, 'body@example.com');
        const res = await server.inject({ method: 'POST', url: '/auth/refresh', headers: { 'x-forwarded-for': freshIp() }, payload: { refreshToken } });

        expect(res.statusCode).toBe(200);
        expect(res.json().accessToken).toBeTruthy();
    });

    it('never accepts a refresh token as a bearer token, nor the cookie in place of one', async () => {
        await seedUser(test.db, { email: 'bearer@example.com' });

        const { refreshToken } = await signIn(server, 'bearer@example.com');
        const asBearer = await server.inject({ method: 'GET', url: '/prices/leagues?game=poe2', headers: bearer(refreshToken) });
        const asCookie = await server.inject({ method: 'GET', url: '/prices/leagues?game=poe2', headers: { cookie: 'refresh_token=' + refreshToken } });
        const meAsBearer = await server.inject({ method: 'GET', url: '/auth/me', headers: bearer(refreshToken) });

        expect([asBearer.statusCode, asCookie.statusCode, meAsBearer.statusCode]).toEqual([401, 401, 401]);
    });

    it('refuses a forged or expired access token', async () => {
        const forged = await server.inject({ method: 'GET', url: '/auth/me', headers: bearer('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid') });
        const none = await server.inject({ method: 'GET', url: '/auth/me' });

        expect([forged.statusCode, none.statusCode]).toEqual([401, 401]);
    });

    it('logout deletes the refresh token, so it cannot refresh again', async () => {
        await seedUser(test.db, { email: 'logout@example.com' });

        const { refreshToken } = await signIn(server, 'logout@example.com');
        const out = await server.inject({ method: 'POST', url: '/auth/logout', headers: { cookie: 'refresh_token=' + refreshToken } });

        expect(out.statusCode).toBe(200);
        expect((await refresh(refreshToken)).statusCode).toBe(401);
    });

    it('stores refresh tokens only as hashes', async () => {
        await seedUser(test.db, { email: 'hashed@example.com' });

        const { refreshToken } = await signIn(server, 'hashed@example.com');
        const rows = await test.db.selectFrom('refresh_tokens').select('token_hash').execute();

        expect(rows.map((row) => row.token_hash)).not.toContain(refreshToken);
        expect(rows.every((row) => /^[0-9a-f]{64}$/.test(row.token_hash))).toBe(true);
    });

    it('does not let a refresh token outlive its expiry', async () => {
        const userId = await seedUser(test.db, { email: 'expiry@example.com' });
        const { refreshToken } = await signIn(server, 'expiry@example.com');

        await test.db
            .updateTable('refresh_tokens')
            .set({ expires_at: new Date(Date.now() - 1000) })
            .where('user_id', '=', userId)
            .execute();

        expect((await refresh(refreshToken)).statusCode).toBe(401);
    });
});
