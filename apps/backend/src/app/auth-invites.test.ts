import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, freshIp, seedUser, signIn, TEST_PASSWORD } from '../testing/auth-helpers.js';
import { buildTestApp } from '../testing/build-app.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../testing/test-database.js';

const run = promisify(execFile);

const BOOTSTRAP_ENTRY = join(__dirname, '../../dist/apps/backend/src/services/auth/bootstrap-admin.js');

describe.skipIf(SKIP_DB_TESTS)('invites and the first admin', () => {
    let test: TestDatabase;
    let server: Awaited<ReturnType<typeof buildTestApp>>;
    let adminToken: string;

    beforeAll(async () => {
        test = await createTestDatabase();
        process.env.DATABASE_URL = test.url;
        server = await buildTestApp();
    });

    afterAll(async () => {
        await server.close();
        await test.close();
    });

    function register(token: string, email: string, password = TEST_PASSWORD) {
        return server.inject({
            method: 'POST',
            url: '/auth/register',
            headers: { 'x-forwarded-for': freshIp() },
            payload: { token, email, displayName: 'Friend', password },
        });
    }

    async function createInvite(role: 'admin' | 'member' = 'member'): Promise<{ id: string; token: string }> {
        const res = await server.inject({ method: 'POST', url: '/admin/invites', headers: bearer(adminToken), payload: { role } });

        expect(res.statusCode).toBe(200);

        const body = res.json<{ invite: { id: string }; token: string }>();

        return { id: body.invite.id, token: body.token };
    }

    async function runBootstrap() {
        return run('node', [BOOTSTRAP_ENTRY], { env: { ...process.env, DATABASE_URL: test.url, NODE_ENV: 'test' } });
    }

    it('issues the first admin an invite from the built command, which registers an admin, and then refuses to run again', async () => {
        const { stdout } = await runBootstrap();
        const path = stdout.split('\n').find((line) => line.startsWith('/invite/'));

        expect(path).toBeTruthy();

        const token = (path ?? '').replace('/invite/', '');
        const res = await register(token, 'owner@example.com');

        expect(res.statusCode).toBe(200);
        expect(res.json().user).toMatchObject({ email: 'owner@example.com', role: 'admin' });

        await expect(runBootstrap()).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('An admin already exists') });

        adminToken = (await signIn(server, 'owner@example.com')).accessToken;
    });

    it('lets a member invite register a second account, and the same link then fails', async () => {
        const { token } = await createInvite();
        const first = await register(token, 'friend@example.com');

        expect(first.statusCode).toBe(200);
        expect(first.json().user).toMatchObject({ role: 'member' });

        const prices = await server.inject({ method: 'GET', url: '/prices/leagues?game=poe2', headers: bearer(first.json().accessToken) });

        expect(prices.statusCode).not.toBe(401);

        const again = await register(token, 'another@example.com');

        expect(again.statusCode).toBe(410);
        expect(again.json()).toMatchObject({ error: 'INVITE_INVALID' });
        expect((await server.inject({ method: 'GET', url: `/auth/invites/${token}` })).statusCode).toBe(410);
    });

    it('creates one account when two people submit the same invite at once', async () => {
        const { token } = await createInvite();
        const results = await Promise.all([register(token, 'a-race@example.com'), register(token, 'b-race@example.com')]);

        expect(results.map((res) => res.statusCode).sort()).toEqual([200, 410]);

        const accounts = await test.db.selectFrom('users').select('email').where('email', 'in', ['a-race@example.com', 'b-race@example.com']).execute();

        expect(accounts).toHaveLength(1);
    });

    it('refuses an expired invite, and says so on the preview too', async () => {
        const { id, token } = await createInvite();

        await test.db
            .updateTable('invites')
            .set({ expires_at: new Date(Date.now() - 1000) })
            .where('id', '=', id)
            .execute();

        expect((await register(token, 'late@example.com')).statusCode).toBe(410);
        expect((await server.inject({ method: 'GET', url: `/auth/invites/${token}` })).statusCode).toBe(410);
    });

    it('refuses a revoked invite, and a revoked invite leaves the open list', async () => {
        const { id, token } = await createInvite();

        expect((await server.inject({ method: 'DELETE', url: `/admin/invites/${id}`, headers: bearer(adminToken) })).statusCode).toBe(204);
        expect((await register(token, 'revoked@example.com')).statusCode).toBe(410);

        const open = await server.inject({ method: 'GET', url: '/admin/invites', headers: bearer(adminToken) });

        expect(open.json<{ invites: { id: string }[] }>().invites.map((invite) => invite.id)).not.toContain(id);
    });

    it('keeps the invite usable when the account cannot be created, so the link works for another address', async () => {
        const { token } = await createInvite();

        await seedUser(test.db, { email: 'taken@example.com' });

        const clash = await register(token, 'Taken@Example.com');

        expect(clash.statusCode).toBe(409);
        expect(await test.db.selectFrom('invites').select('used_at').where('used_at', 'is not', null).where('used_by', 'is', null).execute()).toHaveLength(0);
        expect((await register(token, 'fresh@example.com')).statusCode).toBe(200);
    });

    it('previews an open invite with its role and stores only its hash', async () => {
        const { token } = await createInvite('admin');
        const preview = await server.inject({ method: 'GET', url: `/auth/invites/${token}` });
        const stored = await test.db.selectFrom('invites').select('token_hash').execute();

        expect(preview.json()).toMatchObject({ role: 'admin' });
        expect(stored.map((row) => row.token_hash)).not.toContain(token);
    });

    it('rejects a weak password and a malformed email without spending the invite', async () => {
        const { token } = await createInvite();

        expect((await register(token, 'weak@example.com', 'short')).statusCode).toBe(400);
        expect((await register(token, 'not-an-email')).statusCode).toBe(400);
        expect((await register(token, 'ok@example.com')).statusCode).toBe(200);
    });

    it('keeps invite administration from members', async () => {
        const member = await signIn(server, 'friend@example.com');
        const res = await server.inject({ method: 'POST', url: '/admin/invites', headers: bearer(member.accessToken), payload: { role: 'admin' } });

        expect(res.statusCode).toBe(403);
    });
});
