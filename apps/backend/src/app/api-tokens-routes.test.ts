import { MAX_API_TOKENS } from '@poelens/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authenticateApiToken } from '../services/api-tokens/index.js';
import { bearer, freshIp, seedUser, signIn } from '../testing/auth-helpers.js';
import { buildTestApp } from '../testing/build-app.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../testing/test-database.js';

const MCP_HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
const INITIALIZE = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
};
const NEW_PASSWORD = 'a brand new password';

describe.skipIf(SKIP_DB_TESTS)('API tokens over HTTP', () => {
    let test: TestDatabase;
    let server: Awaited<ReturnType<typeof buildTestApp>>;
    let adminToken: string;

    beforeAll(async () => {
        test = await createTestDatabase();
        process.env.DATABASE_URL = test.url;
        server = await buildTestApp();
        await seedUser(test.db, { email: 'admin@example.com', role: 'admin' });
        adminToken = (await signIn(server, 'admin@example.com')).accessToken;
    });

    afterAll(async () => {
        await server.close();
        await test.close();
    });

    /** A fresh member with a session, so no test shares tokens or limits with another. */
    async function member(name: string) {
        const email = `${name}@example.com`;
        const userId = await seedUser(test.db, { email });

        return { userId, email, session: await signIn(server, email) };
    }

    async function createToken(accessToken: string, name = 'Claude Code', ip = freshIp()) {
        return server.inject({ method: 'POST', url: '/api-tokens', headers: { ...bearer(accessToken), 'x-forwarded-for': ip }, payload: { name } });
    }

    async function mint(accessToken: string, name?: string) {
        const res = await createToken(accessToken, name);

        expect(res.statusCode).toBe(201);

        return res.json<{ token: { id: string; name: string }; secret: string }>();
    }

    function mcp(secret: string, ip = freshIp(), payload: object = INITIALIZE) {
        return server.inject({ method: 'POST', url: '/mcp', headers: { ...MCP_HEADERS, authorization: 'Bearer ' + secret, 'x-forwarded-for': ip }, payload });
    }

    const admin = (method: 'POST' | 'GET', url: string, payload?: object) =>
        server.inject({ method, url, headers: { ...bearer(adminToken), 'x-forwarded-for': freshIp() }, ...(payload ? { payload } : {}) });

    describe('managing tokens', () => {
        it('creates a token, shows the secret once, and lists it without one', async () => {
            const { session } = await member('creator');
            const res = await createToken(session.accessToken, '  Claude Code  ');
            const body = res.json<{ token: { id: string; name: string; prefix: string; lastUsedAt: string | null }; secret: string }>();

            expect(res.statusCode).toBe(201);
            expect(res.headers['cache-control']).toBe('no-store');
            expect(body.secret).toMatch(/^pl_[A-Za-z0-9_-]{43}$/);
            expect(body.token).toMatchObject({ name: 'Claude Code', prefix: body.secret.slice(0, 10), lastUsedAt: null });

            const list = await server.inject({ method: 'GET', url: '/api-tokens', headers: bearer(session.accessToken) });

            expect(list.statusCode).toBe(200);
            expect(list.json()).toMatchObject({ max: MAX_API_TOKENS, tokens: [{ id: body.token.id, name: 'Claude Code' }] });
            expect(list.body).not.toContain(body.secret);
            expect(list.body).not.toContain(body.secret.slice(10));
        });

        it('validates the name', async () => {
            const { session } = await member('validator');

            for (const name of ['', '   ', 'x'.repeat(61)]) {
                expect((await createToken(session.accessToken, name)).statusCode).toBe(400);
            }

            expect((await server.inject({ method: 'POST', url: '/api-tokens', headers: bearer(session.accessToken), payload: {} })).statusCode).toBe(400);
        });

        it('stops at the cap with a 409 and a code, and a revoke frees a place', async () => {
            const { session } = await member('capped');
            const first = await mint(session.accessToken);

            for (let index = 1; index < MAX_API_TOKENS; index += 1) await mint(session.accessToken, 'token ' + index);

            const over = await createToken(session.accessToken);

            expect(over.statusCode).toBe(409);
            expect(over.json()).toMatchObject({ error: 'API_TOKENS_FULL' });

            const gone = await server.inject({ method: 'DELETE', url: '/api-tokens/' + first.token.id, headers: bearer(session.accessToken) });

            expect(gone.statusCode).toBe(204);
            expect((await createToken(session.accessToken)).statusCode).toBe(201);
        });

        it("revokes only the caller's own token, answering 204 either way", async () => {
            const owner = await member('owner');
            const other = await member('other');
            const { token, secret } = await mint(owner.session.accessToken);
            const attempt = await server.inject({ method: 'DELETE', url: '/api-tokens/' + token.id, headers: bearer(other.session.accessToken) });

            expect(attempt.statusCode).toBe(204);
            expect((await mcp(secret)).statusCode).toBe(200);
            expect((await server.inject({ method: 'DELETE', url: '/api-tokens/not-a-uuid', headers: bearer(owner.session.accessToken) })).statusCode).toBe(400);
        });
    });

    describe('what a token and a session may reach', () => {
        it('lets a token do nothing outside /mcp', async () => {
            const { session } = await member('boundary');
            const { token, secret } = await mint(session.accessToken);
            const headers = { authorization: 'Bearer ' + secret, 'x-forwarded-for': freshIp() };
            const routes = [
                { method: 'GET', url: '/auth/me' },
                { method: 'GET', url: '/admin/users' },
                { method: 'GET', url: '/api-tokens' },
                { method: 'POST', url: '/api-tokens', payload: { name: 'sneaky' } },
                { method: 'DELETE', url: '/api-tokens/' + token.id },
                { method: 'GET', url: '/watchlist?game=poe2' },
                { method: 'PUT', url: '/watchlist/1' },
                { method: 'DELETE', url: '/watchlist/1' },
                { method: 'GET', url: '/prices/leagues?game=poe2' },
            ] as const;

            for (const route of routes) {
                const res = await server.inject({ ...route, headers });

                expect([route.method + ' ' + route.url, res.statusCode]).toEqual([route.method + ' ' + route.url, 401]);
            }

            // Nothing above revoked or created anything.
            expect(await authenticateApiToken(test.db, secret)).not.toBeNull();
            expect((await server.inject({ method: 'GET', url: '/api-tokens', headers: bearer(session.accessToken) })).json().tokens).toHaveLength(1);
        });

        it('refuses a session access token at /mcp, with a challenge', async () => {
            const { session } = await member('jwt');
            const res = await server.inject({ method: 'POST', url: '/mcp', headers: { ...MCP_HEADERS, ...bearer(session.accessToken) }, payload: INITIALIZE });

            expect(res.statusCode).toBe(401);
            expect(res.headers['www-authenticate']).toBe('Bearer');
        });

        it('refuses a well-shaped token nobody holds', async () => {
            const res = await mcp('pl_' + 'B'.repeat(43));

            expect(res.statusCode).toBe(401);
            expect(res.headers['www-authenticate']).toBe('Bearer');
        });

        it('answers 405 to GET and DELETE, with a valid token, and says what is allowed', async () => {
            const { session } = await member('methods');
            const { secret } = await mint(session.accessToken);

            for (const method of ['GET', 'DELETE'] as const) {
                const res = await server.inject({ method, url: '/mcp', headers: { authorization: 'Bearer ' + secret, 'x-forwarded-for': freshIp() } });

                expect(res.statusCode).toBe(405);
                expect(res.headers.allow).toBe('POST');
            }
        });

        it('serves a valid token, and marks it used', async () => {
            const { session } = await member('serves');
            const { secret } = await mint(session.accessToken);
            const res = await mcp(secret);

            expect(res.statusCode).toBe(200);
            expect(res.body).toContain('"serverInfo"');

            const list = await server.inject({ method: 'GET', url: '/api-tokens', headers: bearer(session.accessToken) });

            expect(list.json().tokens[0].lastUsedAt).toEqual(expect.any(String));
        });

        it('takes the Bearer scheme in any case, but the token as it is', async () => {
            const { session } = await member('scheme');
            const { secret } = await mint(session.accessToken);
            const call = (authorization: string) =>
                server.inject({ method: 'POST', url: '/mcp', headers: { ...MCP_HEADERS, authorization, 'x-forwarded-for': freshIp() }, payload: INITIALIZE });

            expect((await call('bearer ' + secret)).statusCode).toBe(200);
            expect((await call('BEARER ' + secret)).statusCode).toBe(200);
            expect((await call('Bearer ' + secret.toUpperCase())).statusCode).toBe(401);
        });
    });

    describe('ending a token', () => {
        it('on the next call after a revoke', async () => {
            const { session } = await member('revoker');
            const { token, secret } = await mint(session.accessToken);

            expect((await mcp(secret)).statusCode).toBe(200);
            await server.inject({ method: 'DELETE', url: '/api-tokens/' + token.id, headers: bearer(session.accessToken) });
            expect((await mcp(secret)).statusCode).toBe(401);
        });

        it('on the next call after the user is deactivated, though the session JWT is still valid for 15 minutes', async () => {
            const { userId, session } = await member('deactivated');
            const { secret } = await mint(session.accessToken);

            expect((await mcp(secret)).statusCode).toBe(200);
            expect((await admin('POST', `/admin/users/${userId}/deactivate`)).statusCode).toBe(200);
            expect((await mcp(secret)).statusCode).toBe(401);

            // Reactivating does not bring it back.
            await admin('POST', `/admin/users/${userId}/reactivate`);
            expect((await mcp(secret)).statusCode).toBe(401);
        });

        it('on the next call after an admin reset is redeemed, and not when the link is merely issued', async () => {
            const { userId, session } = await member('resetter');
            const { secret } = await mint(session.accessToken);
            const link = await admin('POST', `/admin/users/${userId}/reset-link`);

            expect((await mcp(secret)).statusCode).toBe(200);

            const redeemed = await server.inject({
                method: 'POST',
                url: '/auth/reset',
                headers: { 'x-forwarded-for': freshIp() },
                payload: { token: link.json().token, password: NEW_PASSWORD },
            });

            expect(redeemed.statusCode).toBe(200);
            expect((await mcp(secret)).statusCode).toBe(401);
        });

        it('and does not let a session from before the reset mint a new one', async () => {
            const { userId, email, session } = await member('stolen');
            const link = await admin('POST', `/admin/users/${userId}/reset-link`);

            await server.inject({
                method: 'POST',
                url: '/auth/reset',
                headers: { 'x-forwarded-for': freshIp() },
                payload: { token: link.json().token, password: NEW_PASSWORD },
            });

            const refused = await createToken(session.accessToken);

            expect(refused.statusCode).toBe(401);
            expect(refused.json()).toMatchObject({ error: 'TOKEN_INVALID' });
            expect(await test.db.selectFrom('api_tokens').select('id').where('user_id', '=', userId).execute()).toEqual([]);

            // A session from after the reset is fine. (A sign-in in the very second of the reset is refused once, which is the safe side.)
            await new Promise((resolve) => setTimeout(resolve, 1100));

            const fresh = await signIn(server, email, NEW_PASSWORD);

            expect((await createToken(fresh.accessToken)).statusCode).toBe(201);
        });

        it('and does not let a deactivated user mint one with the session they still hold', async () => {
            const { userId, session } = await member('stolen-too');

            await admin('POST', `/admin/users/${userId}/deactivate`);

            expect((await createToken(session.accessToken)).statusCode).toBe(401);
            expect(await test.db.selectFrom('api_tokens').select('id').where('user_id', '=', userId).execute()).toEqual([]);
        });
    });

    describe('rate limits', () => {
        it('answers 429 per token past 120 calls a minute, with Retry-After, and leaves other tokens alone', async () => {
            const { session } = await member('busy');
            const quiet = await member('quiet');
            const { secret } = await mint(session.accessToken);
            const other = await mint(quiet.session.accessToken);
            const ip = freshIp();
            const call = () => server.inject({ method: 'GET', url: '/mcp', headers: { authorization: 'Bearer ' + secret, 'x-forwarded-for': ip } });
            const statuses: number[] = [];

            for (let index = 0; index < 122; index += 1) statuses.push((await call()).statusCode);

            expect(statuses.slice(0, 120)).toEqual(Array<number>(120).fill(405));
            expect(statuses.slice(120)).toEqual([429, 429]);

            const limited = await call();

            expect(limited.statusCode).toBe(429);
            expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
            expect(limited.json()).toMatchObject({ statusCode: 429, error: 'RATE_LIMITED' });

            // Another token from the very same address is untouched.
            const fine = await server.inject({ method: 'GET', url: '/mcp', headers: { authorization: 'Bearer ' + other.secret, 'x-forwarded-for': ip } });

            expect(fine.statusCode).toBe(405);
        }, 30_000);

        it('answers 429 per address for well-shaped tokens that do not exist, before looking at any token', async () => {
            const ip = freshIp();
            const guess = (index: number) =>
                server.inject({
                    method: 'POST',
                    url: '/mcp',
                    headers: { authorization: 'Bearer pl_' + String(index).padStart(43, 'C'), 'x-forwarded-for': ip },
                    payload: INITIALIZE,
                });
            const statuses: number[] = [];

            for (let index = 0; index < 2502; index += 1) statuses.push((await guess(index)).statusCode);

            expect(new Set(statuses.slice(0, 2500))).toEqual(new Set([401]));
            expect(statuses.slice(2500)).toEqual([429, 429]);

            // Even a real token is turned away from an address that is over the limit, and it counts nowhere else.
            const { session } = await member('victim');
            const { secret } = await mint(session.accessToken);

            expect((await mcp(secret, ip)).statusCode).toBe(429);
            expect((await mcp(secret, freshIp())).statusCode).toBe(200);
        }, 60_000);
    });
});
