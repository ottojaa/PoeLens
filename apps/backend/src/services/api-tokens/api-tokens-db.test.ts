import { ApiTokensFullError, MAX_API_TOKENS, UnauthorizedError } from '@poelens/shared';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedUser } from '../../testing/auth-helpers.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../../testing/test-database.js';
import { deactivateUser } from '../auth/users.js';
import { issueResetLink, redeemReset } from '../auth/resets.js';
import { hashToken } from '../auth/tokens.js';
import { authenticateApiToken, createApiToken, deleteApiTokens, listApiTokens, revokeApiToken } from './index.js';

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe.skipIf(SKIP_DB_TESTS)('API tokens against PostgreSQL', () => {
    let test: TestDatabase;
    let alice: string;
    let bob: string;
    let admin: string;

    beforeAll(async () => {
        test = await createTestDatabase();
        alice = await seedUser(test.db, { email: 'alice@example.com' });
        bob = await seedUser(test.db, { email: 'bob@example.com' });
        admin = await seedUser(test.db, { email: 'admin@example.com', role: 'admin' });
    });

    afterAll(async () => {
        await test.close();
    });

    beforeEach(async () => {
        await sql`TRUNCATE api_tokens`.execute(test.db);
        await sql`TRUNCATE password_resets`.execute(test.db);
        await test.db.updateTable('users').set({ is_active: true }).execute();
    });

    const create = (userId = alice, name = 'Claude Code') => createApiToken(test.db, { userId, name, sessionIssuedAt: nowSeconds() });

    describe('creating', () => {
        it('returns the secret once, and stores only its sha256', async () => {
            const { token, secret } = await create();
            const stored = await test.db.selectFrom('api_tokens').selectAll().execute();

            expect(secret).toMatch(/^pl_[A-Za-z0-9_-]{43}$/);
            expect(stored).toHaveLength(1);
            expect(stored[0]).toMatchObject({ id: token.id, user_id: alice, name: 'Claude Code', token_hash: hashToken(secret), prefix: secret.slice(0, 10) });
            // No column holds the secret itself, or the secret without its prefix.
            expect(JSON.stringify(stored)).not.toContain(secret);
            expect(JSON.stringify(stored)).not.toContain(secret.slice(3));
            expect(token).toMatchObject({ name: 'Claude Code', prefix: secret.slice(0, 10), lastUsedAt: null });
            expect(token).not.toHaveProperty('secret');
        });

        it('never lists a secret', async () => {
            const { secret } = await create();
            const listed = await listApiTokens(test.db, alice);

            expect(listed).toHaveLength(1);
            expect(JSON.stringify(listed)).not.toContain(secret);
        });

        it('holds the cap when many creates race', async () => {
            const results = await Promise.allSettled(Array.from({ length: MAX_API_TOKENS + 6 }, (_, index) => create(alice, 'token ' + index)));
            const refused = results.filter((result) => result.status === 'rejected');
            const count = await test.db
                .selectFrom('api_tokens')
                .select((eb) => eb.fn.countAll<string>().as('count'))
                .where('user_id', '=', alice)
                .executeTakeFirstOrThrow();

            expect(Number(count.count)).toBe(MAX_API_TOKENS);
            expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(MAX_API_TOKENS);
            expect(refused).toHaveLength(6);
            expect(refused.every((result) => result.status === 'rejected' && result.reason instanceof ApiTokensFullError)).toBe(true);
        });

        it("counts each user's tokens on their own", async () => {
            await Promise.all(Array.from({ length: MAX_API_TOKENS }, () => create(alice)));

            await expect(create(bob)).resolves.toMatchObject({ token: { name: 'Claude Code' } });
        });

        it('refuses a deactivated user', async () => {
            await test.db.updateTable('users').set({ is_active: false }).where('id', '=', bob).execute();

            await expect(create(bob)).rejects.toBeInstanceOf(UnauthorizedError);
        });

        it('refuses a session issued before a reset was redeemed, and one issued before the user last changed', async () => {
            const issuedBefore = nowSeconds() - 5;
            const { token } = await issueResetLink(test.db, { userId: bob, createdBy: admin });

            await redeemReset(test.db, { token, password: 'a brand new password' });

            await expect(createApiToken(test.db, { userId: bob, name: 'stolen', sessionIssuedAt: issuedBefore })).rejects.toMatchObject({
                statusCode: 401,
                code: 'TOKEN_INVALID',
            });
            expect(await listApiTokens(test.db, bob)).toEqual([]);

            await expect(createApiToken(test.db, { userId: bob, name: 'fresh', sessionIssuedAt: nowSeconds() + 2 })).resolves.toBeDefined();
        });
    });

    describe('revoking', () => {
        it('deletes the row, only for its owner, and is idempotent', async () => {
            const { token } = await create(alice);

            await revokeApiToken(test.db, bob, token.id);
            expect(await listApiTokens(test.db, alice)).toHaveLength(1);

            await revokeApiToken(test.db, alice, token.id);
            await revokeApiToken(test.db, alice, token.id);
            expect(await listApiTokens(test.db, alice)).toEqual([]);
        });
    });

    describe('authenticating', () => {
        it('answers with the owner and the token, and nothing for an unknown secret', async () => {
            const { token, secret } = await create();

            expect(await authenticateApiToken(test.db, secret)).toEqual({ userId: alice, via: 'api-token', credentialId: token.id });
            expect(await authenticateApiToken(test.db, 'pl_' + 'A'.repeat(43))).toBeNull();
        });

        it('stops on the next call after the token is revoked', async () => {
            const { token, secret } = await create();

            expect(await authenticateApiToken(test.db, secret)).not.toBeNull();
            await revokeApiToken(test.db, alice, token.id);
            expect(await authenticateApiToken(test.db, secret)).toBeNull();
        });

        it('stops when the user is deactivated, and the tokens are deleted with their sessions', async () => {
            const { secret } = await create(bob);

            await deactivateUser(test.db, admin, bob);

            expect(await authenticateApiToken(test.db, secret)).toBeNull();
            expect(await listApiTokens(test.db, bob)).toEqual([]);
        });

        it('stops on a user flag alone (the join is a second check) even if the row is still there', async () => {
            const { secret } = await create(bob);

            await test.db.updateTable('users').set({ is_active: false }).where('id', '=', bob).execute();

            expect(await authenticateApiToken(test.db, secret)).toBeNull();
        });

        it('stops after an admin password reset is redeemed, not before', async () => {
            const { secret } = await create(bob);
            const { token } = await issueResetLink(test.db, { userId: bob, createdBy: admin });

            expect(await authenticateApiToken(test.db, secret)).not.toBeNull();
            await redeemReset(test.db, { token, password: 'a brand new password' });
            expect(await authenticateApiToken(test.db, secret)).toBeNull();
            expect(await listApiTokens(test.db, bob)).toEqual([]);
        });

        it("deleteApiTokens ends one user's tokens only", async () => {
            await create(alice);
            await create(bob);
            await deleteApiTokens(test.db, alice);

            expect(await listApiTokens(test.db, alice)).toEqual([]);
            expect(await listApiTokens(test.db, bob)).toHaveLength(1);
        });

        it('writes last_used_at on first use and at most once a minute after that', async () => {
            const { token, secret } = await create();
            const lastUsed = async () => (await listApiTokens(test.db, alice)).find((entry) => entry.id === token.id)?.lastUsedAt;

            expect(await lastUsed()).toBeNull();
            await authenticateApiToken(test.db, secret);

            const first = await lastUsed();

            expect(first).toEqual(expect.any(String));
            await authenticateApiToken(test.db, secret);
            expect(await lastUsed()).toBe(first);

            await sql`UPDATE api_tokens SET last_used_at = now() - interval '2 minutes' WHERE id = ${token.id}`.execute(test.db);
            await authenticateApiToken(test.db, secret);
            expect(new Date((await lastUsed()) ?? 0).getTime()).toBeGreaterThan(Date.now() - 60_000);
        });
    });
});
