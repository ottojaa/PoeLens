import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MAX_WATCHLIST_ITEMS, POE_NINJA_ATTRIBUTION, WatchlistResponseSchema } from '@poelens/shared';
import { sql } from 'kysely';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCycle } from '../collector/runtime.js';
import { createPoeNinjaPoe2Adapter } from '../collector/sources/poe-ninja/poe2.js';
import { createPgCollectorStore } from '../collector/store-pg.js';
import { createApiToken } from '../services/api-tokens/index.js';
import { bearer, seedUser, signIn } from '../testing/auth-helpers.js';
import { buildTestApp } from '../testing/build-app.js';
import { FakeNinja } from '../testing/fake-ninja.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../testing/test-database.js';

const HOUR = 3_600_000;
const COLLECTED = ['Currency', 'UniqueWeapons'];

interface ToolAnswer {
    text: string;
    isError: boolean;
}

describe.skipIf(SKIP_DB_TESTS)('the MCP tools, through the SDK client against the built app', () => {
    let test: TestDatabase;
    let server: Awaited<ReturnType<typeof buildTestApp>>;
    let baseUrl: string;
    let aliceId: string;
    let sessionToken: string;
    const clients = new Map<string, Client>();

    /** Only the two categories the recorded fixtures are for: every other category would repeat the same names. */
    const adapter = (() => {
        const full = createPoeNinjaPoe2Adapter({ leagues: ['Forbidden Rites'] });

        return { ...full, plan: (known: Parameters<typeof full.plan>[0]) => full.plan(known).filter((request) => COLLECTED.includes(request.category)) };
    })();

    async function itemId(name: string): Promise<number> {
        return (await test.db.selectFrom('items').select('id').where('name', '=', name).where('game', '=', 'poe2').orderBy('id').executeTakeFirstOrThrow()).id;
    }

    /** A price a day before the latest one, so that the item has a 24h change: `factor` times today's. */
    async function insertYesterday(name: string, factor: number): Promise<void> {
        const id = await itemId(name);
        const latest = await test.db.selectFrom('prices').selectAll().where('item_id', '=', id).orderBy('time', 'desc').executeTakeFirstOrThrow();
        const category = (await test.db.selectFrom('items').select('category').where('id', '=', id).executeTakeFirstOrThrow()).category;
        const raw = await test.db
            .insertInto('raw_responses')
            .values({
                source: 'poe.ninja',
                game: 'poe2',
                kind: 'exchange',
                league: 'Forbidden Rites',
                category,
                url: 'https://example.invalid/' + name,
                fetched_at: new Date(latest.time.getTime() - 24 * HOUR),
                status: 200,
                etag: null,
                sha256: 'earlier-' + name,
                body: Buffer.alloc(0),
                parser_version: 1,
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        await test.db
            .insertInto('prices')
            .values({
                ...latest,
                time: new Date(latest.time.getTime() - 24 * HOUR),
                divine: latest.divine * factor,
                exalted: latest.exalted * factor,
                chaos: latest.chaos * factor,
                raw_id: raw.id,
            })
            .execute();
    }

    beforeAll(async () => {
        test = await createTestDatabase();
        await runCycle({ adapter, store: createPgCollectorStore(test.db), fetcher: new FakeNinja(), now: () => new Date() });
        await insertYesterday('Divine Orb', 0.5);
        await insertYesterday('The Ordained', 2);
        // Two items with one name, in different categories, with no prices: the duplicates a name cannot tell apart.
        await test.db
            .insertInto('items')
            .values([
                { game: 'poe2', name: 'Twin Orb', category: 'Currency' },
                { game: 'poe2', name: 'Twin Orb', category: 'Fragments' },
            ])
            .execute();
        process.env.DATABASE_URL = test.url;
        server = await buildTestApp();
        await server.listen({ port: 0, host: '127.0.0.1' });
        baseUrl = `http://127.0.0.1:${(server.server.address() as AddressInfo).port}`;
        aliceId = await seedUser(test.db, { email: 'alice@example.com' });
        sessionToken = (await signIn(server, 'alice@example.com')).accessToken;
    });

    afterAll(async () => {
        await Promise.all([...clients.values()].map((client) => client.close()));
        await server.close();
        await test.close();
    });

    /** One client, with a token of its own, per user: a user can only hold ten tokens. */
    async function connect(userId = aliceId): Promise<Client> {
        const known = clients.get(userId);

        if (known) return known;

        const { secret } = await createApiToken(test.db, { userId, name: 'tools test', sessionIssuedAt: Math.floor(Date.now() / 1000) });
        const client = new Client({ name: 'tools-test', version: '1.0.0' });

        await client.connect(new StreamableHTTPClientTransport(new URL(baseUrl + '/mcp'), { requestInit: { headers: { authorization: 'Bearer ' + secret } } }));
        clients.set(userId, client);

        return client;
    }

    async function ask(client: Client, name: string, args: Record<string, unknown>): Promise<ToolAnswer> {
        const result = await client.callTool({ name, arguments: args });
        const content = result.content as { type: string; text: string }[];

        return { text: content.map((part) => part.text).join('\n'), isError: result.isError === true };
    }

    const watchedIds = async () =>
        (await test.db.selectFrom('watchlist_items').select('item_id').where('user_id', '=', aliceId).execute()).map((row) => row.item_id);
    const occurrences = (text: string, part: string) => text.split(part).length - 1;

    it('lists seven tools, the reads read-only and the writes idempotent writes', async () => {
        const client = await connect();
        const { tools } = await client.listTools();
        const byName = new Map(tools.map((tool) => [tool.name, tool]));

        expect([...byName.keys()].sort()).toEqual(
            ['get_prices', 'get_price_history', 'get_top_movers', 'get_watchlist', 'search_items', 'unwatch_item', 'watch_item'].sort(),
        );

        for (const name of ['get_prices', 'search_items', 'get_price_history', 'get_top_movers', 'get_watchlist']) {
            expect(byName.get(name)?.annotations).toMatchObject({ readOnlyHint: true });
        }

        for (const name of ['watch_item', 'unwatch_item']) {
            expect(byName.get(name)?.annotations).toMatchObject({ readOnlyHint: false, idempotentHint: true });
        }
    });

    describe('reads', () => {
        it('prices an item by name, in its own unit and in divine, crediting poe.ninja once', async () => {
            const answer = await ask(await connect(), 'get_prices', { items: ['Divine Orb', 'Orb of Annulment'] });

            expect(answer.isError).toBe(false);
            expect(answer.text).toContain('Path of Exile 2 · Forbidden Rites · unit: auto');
            expect(answer.text).toMatch(/Divine Orb \(id \d+\): 1\.00 div \| 24h \+100\.0%/);
            expect(answer.text).toMatch(/Orb of Annulment \(id \d+\): .* c = .* div/);
            expect(occurrences(answer.text, POE_NINJA_ATTRIBUTION)).toBe(1);
        });

        it('takes a name in any case, an id, and a fixed unit', async () => {
            const id = await itemId('Divine Orb');
            const answer = await ask(await connect(), 'get_prices', { items: ['divine orb', String(id)], unit: 'exalted' });

            expect(answer.text).toContain('unit: exalted');
            expect(occurrences(answer.text, 'Divine Orb (id ' + id + ')')).toBe(2);
        });

        it('takes a clearly best search hit for a read, and says "did you mean" when there is none', async () => {
            const client = await connect();
            const close = await ask(client, 'get_prices', { items: ['Mirror of Kalandr'] });
            const unclear = await ask(client, 'get_prices', { items: ['orb'] });

            expect(close.text).toContain('Mirror of Kalandra');
            expect(unclear.text).toContain('Did you mean');
            expect(unclear.text).not.toMatch(/\| 24h/);
        });

        it('answers "did you mean" with ids for a name that two items have, and still prices the others', async () => {
            const answer = await ask(await connect(), 'get_prices', { items: ['Twin Orb', 'Divine Orb'] });

            expect(answer.text).toContain('More than one item is named "Twin Orb"');
            expect(answer.text).toMatch(/Twin Orb \(Currency, id \d+\)/);
            expect(answer.text).toMatch(/Twin Orb \(Fragments, id \d+\)/);
            expect(answer.text).toMatch(/Divine Orb \(id \d+\): 1\.00 div/);
        });

        it('says an item has no price when it is not in the latest snapshot', async () => {
            const [twin] = await test.db.selectFrom('items').select('id').where('name', '=', 'Twin Orb').orderBy('id').execute();
            const answer = await ask(await connect(), 'get_prices', { items: [String(twin?.id)] });

            expect(answer.text).toContain('no current price');
        });

        it('answers an unknown league with the leagues there are', async () => {
            const answer = await ask(await connect(), 'get_prices', { items: ['Divine Orb'], league: 'Nonexistent League' });

            expect(answer.isError).toBe(true);
            expect(answer.text).toContain('No league "Nonexistent League"');
            expect(answer.text).toContain('Forbidden Rites (current)');
        });

        it('searches with typos, and prices what it finds', async () => {
            const answer = await ask(await connect(), 'search_items', { query: 'divne', limit: 3 });

            expect(answer.text.split('\n')[1]).toMatch(/^Divine Orb \(id \d+\)/);
        });

        it('summarises a history and lists its points', async () => {
            const answer = await ask(await connect(), 'get_price_history', { item: 'Divine Orb', days: 7 });

            expect(answer.isError).toBe(false);
            expect(answer.text).toMatch(/Divine Orb \(Currency, id \d+\): .* -> .* \(\+100\.0%\), low .*, high /);
            expect(answer.text).toContain('daily points, last 7 d');
            expect(answer.text).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/);
        });

        it('names the risers and fallers of a group, ranked in the default unit', async () => {
            const client = await connect();
            const all = await ask(client, 'get_top_movers', { window: '24h' });
            const uniques = await ask(client, 'get_top_movers', { category: 'uniques' });

            expect(all.text).toContain('ranked in exalted');
            expect(all.text).toMatch(/Risers:\n1\. \[24h \+100\.0%\] Divine Orb/);
            expect(uniques.text).toMatch(/Fallers:\n1\. \[24h -50\.0%\] The Ordained/);
            expect(uniques.text).toContain('Risers: none');
            expect(await ask(client, 'get_top_movers', { category: 'Bogus' })).toMatchObject({ isError: true });
        });
    });

    describe('the watchlist', () => {
        const webList = async () =>
            WatchlistResponseSchema.parse((await server.inject({ method: 'GET', url: '/watchlist?game=poe2', headers: bearer(sessionToken) })).json());

        it('adds by exact name, shows up on the web list, is idempotent, and removes', async () => {
            const client = await connect();
            const added = await ask(client, 'watch_item', { item: 'mirror of kalandra' });

            expect(added.isError).toBe(false);
            expect(added.text).toContain('Watching Mirror of Kalandra. The watchlist now has 1 of 100 items.');
            expect((await webList()).rows.map((row) => row.item.name)).toEqual(['Mirror of Kalandra']);

            expect((await ask(client, 'watch_item', { item: 'Mirror of Kalandra' })).text).toContain('now has 1 of 100');

            const listed = await ask(client, 'get_watchlist', {});

            expect(listed.text).toContain('watching 1 of 100');
            expect(listed.text).toContain('Mirror of Kalandra');

            const removed = await ask(client, 'unwatch_item', { item: 'Mirror of Kalandra' });

            expect(removed.text).toContain('No longer watching Mirror of Kalandra. The watchlist now has 0 of 100');
            expect(await watchedIds()).toEqual([]);
            expect((await ask(client, 'unwatch_item', { item: 'Mirror of Kalandra' })).isError).toBe(false);
        });

        it('writes nothing for a name that two items share', async () => {
            const answer = await ask(await connect(), 'watch_item', { item: 'Twin Orb' });

            expect(answer.text).toContain('More than one item is named "Twin Orb"');
            expect(answer.text).toContain('Nothing was changed');
            expect(await watchedIds()).toEqual([]);
        });

        it('writes nothing for a name that is not exact, even a close one, and lists candidates', async () => {
            const client = await connect();
            const answer = await ask(client, 'watch_item', { item: 'Mirror of Kalandr' });

            expect(answer.text).toContain('is not an exact item name');
            expect(answer.text).toContain('Mirror of Kalandra');
            expect(await watchedIds()).toEqual([]);

            const removing = await ask(client, 'unwatch_item', { item: 'Mirror of Kalandr' });

            expect(removing.text).toContain('Nothing was changed');
        });

        it('refuses an unknown id and a text nothing matches, without writing', async () => {
            const client = await connect();

            expect((await ask(client, 'watch_item', { item: '99999999' })).text).toContain('No item matches');
            expect((await ask(client, 'watch_item', { item: 'zzzzzzzzzz' })).text).toContain('No item matches');
            expect(await watchedIds()).toEqual([]);
        });

        it('says a full list is full, adds nothing, and still lets a watched item be "added"', async () => {
            const client = await connect();
            const fillers = await test.db
                .insertInto('items')
                .values(Array.from({ length: MAX_WATCHLIST_ITEMS }, (_, index) => ({ game: 'poe2', name: 'Filler ' + index, category: 'Filler' })))
                .returning('id')
                .execute();

            await test.db
                .insertInto('watchlist_items')
                .values(fillers.map((filler) => ({ user_id: aliceId, item_id: filler.id })))
                .execute();

            const refused = await ask(client, 'watch_item', { item: 'Divine Orb' });

            expect(refused.isError).toBe(true);
            expect(refused.text).toContain('The watchlist is full (100 items)');
            expect(refused.text).toContain('Nothing was added');
            expect(await watchedIds()).toHaveLength(MAX_WATCHLIST_ITEMS);
            expect((await ask(client, 'watch_item', { item: 'Filler 3' })).isError).toBe(false);
            expect((await ask(client, 'get_watchlist', { limit: 2 })).text).toContain('watching 100 of 100');

            await sql`TRUNCATE watchlist_items`.execute(test.db);
        });

        it("never touches another user's list", async () => {
            const bob = await seedUser(test.db, { email: 'bob@example.com' });
            const bobs = await connect(bob);

            await ask(bobs, 'watch_item', { item: 'Divine Orb' });

            expect(await watchedIds()).toEqual([]);
            expect((await ask(await connect(), 'get_watchlist', {})).text).toContain('The watchlist is empty');
            await sql`TRUNCATE watchlist_items`.execute(test.db);
        });
    });
});
