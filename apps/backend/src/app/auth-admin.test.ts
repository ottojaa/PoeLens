import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, freshIp, seedUser, signIn, TEST_PASSWORD } from '../testing/auth-helpers.js';
import { buildTestApp } from '../testing/build-app.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../testing/test-database.js';

describe.skipIf(SKIP_DB_TESTS)('admin: users, deactivation and password resets', () => {
    let test: TestDatabase;
    let server: Awaited<ReturnType<typeof buildTestApp>>;
    let adminToken: string;
    let adminId: string;

    beforeAll(async () => {
        test = await createTestDatabase();
        process.env.DATABASE_URL = test.url;
        server = await buildTestApp();
        await seedUser(test.db, { email: 'admin@example.com', role: 'admin' });

        const admin = await signIn(server, 'admin@example.com');

        adminToken = admin.accessToken;
        adminId = admin.userId;
    });

    afterAll(async () => {
        await server.close();
        await test.close();
    });

    function post(url: string, token = adminToken, payload?: object) {
        return server.inject({ method: 'POST', url, headers: { ...bearer(token), 'x-forwarded-for': freshIp() }, ...(payload ? { payload } : {}) });
    }

    function refresh(refreshToken: string) {
        return server.inject({ method: 'POST', url: '/auth/refresh', headers: { 'x-forwarded-for': freshIp(), cookie: 'refresh_token=' + refreshToken } });
    }

    it('keeps the admin routes from signed-out visitors and from members', async () => {
        await seedUser(test.db, { email: 'plain@example.com' });

        const member = await signIn(server, 'plain@example.com');
        const signedOut = await server.inject({ method: 'GET', url: '/admin/users' });
        const asMember = await server.inject({ method: 'GET', url: '/admin/users', headers: bearer(member.accessToken) });

        expect(signedOut.statusCode).toBe(401);
        expect(asMember.statusCode).toBe(403);
    });

    it('lists users without any secret', async () => {
        const res = await server.inject({ method: 'GET', url: '/admin/users', headers: bearer(adminToken) });
        const body = res.json<{ users: Record<string, unknown>[] }>();

        expect(res.statusCode).toBe(200);
        expect(body.users.length).toBeGreaterThanOrEqual(1);
        expect(JSON.stringify(body)).not.toMatch(/password|hash/i);
    });

    it('refuses an admin deactivating themselves', async () => {
        const res = await post(`/admin/users/${adminId}/deactivate`);

        expect(res.statusCode).toBe(403);
        expect((await test.db.selectFrom('users').select('is_active').where('id', '=', adminId).executeTakeFirstOrThrow()).is_active).toBe(true);
    });

    it('ends every session on deactivation, blocks sign-in, and lets reactivation restore it', async () => {
        const userId = await seedUser(test.db, { email: 'gone@example.com' });
        const session = await signIn(server, 'gone@example.com');

        expect((await post(`/admin/users/${userId}/deactivate`)).statusCode).toBe(200);
        expect((await refresh(session.refreshToken)).statusCode).toBe(401);
        expect(await test.db.selectFrom('refresh_tokens').select('id').where('user_id', '=', userId).execute()).toHaveLength(0);

        const login = await server.inject({
            method: 'POST',
            url: '/auth/login',
            headers: { 'x-forwarded-for': freshIp() },
            payload: { email: 'gone@example.com', password: TEST_PASSWORD },
        });

        expect(login.statusCode).toBe(401);
        expect((await post(`/admin/users/${userId}/reactivate`)).statusCode).toBe(200);
        expect((await signIn(server, 'gone@example.com')).accessToken).toBeTruthy();
    });

    it('stops /auth/me for a deactivated user whose access token is still valid', async () => {
        const userId = await seedUser(test.db, { email: 'stale@example.com' });
        const session = await signIn(server, 'stale@example.com');

        await post(`/admin/users/${userId}/deactivate`);

        const me = await server.inject({ method: 'GET', url: '/auth/me', headers: bearer(session.accessToken) });

        expect(me.statusCode).toBe(401);
    });

    it('takes admin rights away from a deactivated admin at once', async () => {
        const id = await seedUser(test.db, { email: 'oldadmin@example.com', role: 'admin' });
        const session = await signIn(server, 'oldadmin@example.com');

        await post(`/admin/users/${id}/deactivate`);

        expect((await server.inject({ method: 'GET', url: '/admin/users', headers: bearer(session.accessToken) })).statusCode).toBe(403);
    });

    describe('reset links', () => {
        const NEW_PASSWORD = 'a brand new password';

        function reset(token: string, password = NEW_PASSWORD) {
            return server.inject({ method: 'POST', url: '/auth/reset', headers: { 'x-forwarded-for': freshIp() }, payload: { token, password } });
        }

        async function issueLink(userId: string): Promise<string> {
            const res = await post(`/admin/users/${userId}/reset-link`);

            expect(res.statusCode).toBe(200);

            return res.json().token;
        }

        it('sets the new password, ends every session, and works once', async () => {
            const userId = await seedUser(test.db, { email: 'forgot@example.com' });
            const session = await signIn(server, 'forgot@example.com');
            const token = await issueLink(userId);

            expect((await reset(token)).statusCode).toBe(200);
            expect((await refresh(session.refreshToken)).statusCode).toBe(401);
            expect((await reset(token)).statusCode).toBe(410);
            await expect(signIn(server, 'forgot@example.com')).rejects.toThrow();
            expect((await signIn(server, 'forgot@example.com', NEW_PASSWORD)).accessToken).toBeTruthy();
        });

        it('replaces an earlier open link for the same user', async () => {
            const userId = await seedUser(test.db, { email: 'twice@example.com' });
            const first = await issueLink(userId);
            const second = await issueLink(userId);

            expect((await reset(first)).statusCode).toBe(410);
            expect((await reset(second)).statusCode).toBe(200);
        });

        it('refuses an expired link', async () => {
            const userId = await seedUser(test.db, { email: 'late@example.com' });
            const token = await issueLink(userId);

            await test.db
                .updateTable('password_resets')
                .set({ expires_at: new Date(Date.now() - 1000) })
                .where('user_id', '=', userId)
                .execute();

            expect((await reset(token)).statusCode).toBe(410);
        });

        it('keeps the link usable when the new password is refused', async () => {
            const userId = await seedUser(test.db, { email: 'short@example.com' });
            const token = await issueLink(userId);

            expect((await reset(token, 'short')).statusCode).toBe(400);
            expect((await reset(token)).statusCode).toBe(200);
        });

        it('issues no link for a deactivated account, and a link issued earlier stops working once they are deactivated', async () => {
            const inactive = await seedUser(test.db, { email: 'off@example.com', isActive: false });
            const refused = await post(`/admin/users/${inactive}/reset-link`);

            expect(refused.statusCode).toBe(409);
            expect(await test.db.selectFrom('password_resets').select('user_id').where('user_id', '=', inactive).execute()).toEqual([]);

            const userId = await seedUser(test.db, { email: 'leaving@example.com' });
            const token = await issueLink(userId);

            await post(`/admin/users/${userId}/deactivate`);

            expect((await reset(token)).statusCode).toBe(410);
        });

        it('answers 404 for a reset link for nobody', async () => {
            expect((await post('/admin/users/00000000-0000-4000-8000-000000000000/reset-link')).statusCode).toBe(404);
        });
    });
});
