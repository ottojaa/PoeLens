import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MemoryCollectorStore } from '../testing/memory-collector-store.js';
import type { FetchResult, Fetcher } from './http.js';
import { runCycle } from './runtime.js';
import { createPoeNinjaPoe2Adapter } from './sources/poe-ninja/poe2.js';
import { gunzipBody } from './store.js';

const FIXTURES = join(__dirname, 'sources/poe-ninja/fixtures');

function fixture(name: string): Buffer {
    return readFileSync(join(FIXTURES, name));
}

interface Call {
    url: string;
    etag: string | null;
}

/** A fake poe.ninja: serves the recorded fixtures, and answers 304 when asked with the ETag it handed out. */
class FakeNinja implements Fetcher {
    calls: Call[] = [];
    leagues = fixture('leagues.json');
    etagSuffix = 'v1';
    /** Per-URL overrides: a status to answer with, or a body to serve. */
    overrides = new Map<string, { status: number } | { body: Buffer }>();
    failWith: Error | null = null;

    async get(url: string, etag: string | null): Promise<FetchResult> {
        this.calls.push({ url, etag });

        if (this.failWith) throw this.failWith;

        const override = this.overrides.get(url);

        if (override && 'status' in override) return { status: override.status, etag: null, body: Buffer.alloc(0) };

        const body = override && 'body' in override ? override.body : this.bodyFor(url);
        const tag = `W/"${url.length}-${this.etagSuffix}"`;

        if (etag === tag && !override) return { status: 304, etag: tag, body: Buffer.alloc(0) };

        return { status: 200, etag: tag, body };
    }

    private bodyFor(url: string): Buffer {
        if (url.endsWith('/leagues')) return this.leagues;

        return url.includes('/exchange/') ? fixture('exchange-currency.json') : fixture('stash-unique-weapons.json');
    }
}

function setup(leagues: string[] = ['Forbidden Rites']) {
    const ninja = new FakeNinja();
    const store = new MemoryCollectorStore();
    const adapter = createPoeNinjaPoe2Adapter({ leagues });
    let tick = 0;
    const cycle = (signal?: AbortSignal) => runCycle({ adapter, store, fetcher: ninja, now: () => new Date(Date.UTC(2026, 10, 23, 12, 0, tick++)), signal });

    return { ninja, store, adapter, cycle };
}

describe('runCycle', () => {
    it('discovers the leagues, then fetches and stores every request of the plan', async () => {
        const { ninja, store, cycle } = setup();
        const summary = await cycle();

        expect(summary).toMatchObject({ status: 'success', requests: 24, unchanged: 0, stored: 24, parseErrors: 0, fetchErrors: 0, error: null });
        expect(ninja.calls[0]?.url).toBe('https://poe.ninja/poe2/api/economy/leagues');
        expect(store.raws).toHaveLength(24);
        expect(store.raws.every((raw) => raw.parserVersion === 1 && raw.parseError === null)).toBe(true);
        expect(summary.priceRows).toBe(14 * 12 + 9 * 6);
        expect(store.runs[0]?.summary?.status).toBe('success');
    });

    it('archives the gzipped body exactly as fetched', async () => {
        const { store, cycle } = setup();

        await cycle();

        const leagues = store.raws.find((raw) => raw.kind === 'leagues')!;

        expect(gunzipBody(leagues.body)).toBe(fixture('leagues.json').toString('utf8'));
        expect(leagues.sha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it('collects a brand-new league in the same cycle it first appears in', async () => {
        const { ninja, store, cycle } = setup([]);

        ninja.leagues = fixture('leagues-new-first-league.json');
        await cycle();

        const leagues = new Set(store.raws.filter((raw) => raw.kind !== 'leagues').map((raw) => raw.league));

        expect(leagues).toEqual(new Set(['Rise of the Abyssal', 'HC Rise of the Abyssal']));
    });

    it('asks with the ETag of the latest archived row, gets 304s, and stores nothing new', async () => {
        const { ninja, store, cycle } = setup();

        await cycle();
        ninja.calls = [];

        const second = await cycle();

        expect(second).toMatchObject({ status: 'success', requests: 24, unchanged: 24, stored: 0, priceRows: 0 });
        expect(ninja.calls.every((call) => call.etag !== null)).toBe(true);
        expect(store.raws).toHaveLength(24);
        expect(store.applied).toHaveLength(24);
    });

    it('treats a 200 with an identical body like a 304, and moves the new ETag onto the existing row', async () => {
        const { ninja, store, cycle } = setup();

        await cycle();
        ninja.etagSuffix = 'v2';

        const second = await cycle();

        expect(second).toMatchObject({ status: 'success', unchanged: 24, stored: 0, priceRows: 0 });
        expect(store.raws).toHaveLength(24);
        expect(store.raws.every((raw) => raw.etag?.endsWith('-v2"'))).toBe(true);
    });

    it('stores a changed body as a new archived row and writes its rows', async () => {
        const { ninja, store, cycle } = setup();

        await cycle();

        const changed = JSON.parse(fixture('stash-unique-weapons.json').toString('utf8'));

        changed.lines[0].primaryValue += 1;

        const url = 'https://poe.ninja/poe2/api/economy/stash/current/item/overview?league=Forbidden+Rites&type=UniqueWeapons';

        ninja.overrides.set(url, { body: Buffer.from(JSON.stringify(changed)) });

        const second = await cycle();

        expect(second).toMatchObject({ stored: 1, unchanged: 23, priceRows: 6 });
        expect(store.raws).toHaveLength(25);
    });

    it('keeps the response archived when writing its rows fails, and reports the cycle as failed', async () => {
        const { store, cycle } = setup();

        store.failApply = new Error('connection lost');

        const summary = await cycle();

        expect(summary.status).toBe('failed');
        expect(summary.error).toBe('Cycle failed: connection lost');
        expect(store.raws.length).toBeGreaterThan(0);
        expect(store.raws[0]?.parserVersion).toBeNull();
        expect(store.runs[0]?.summary?.status).toBe('failed');
    });

    it('records a parse error on the archived row, carries on, and ends partial', async () => {
        const { ninja, store, cycle } = setup();
        const url = 'https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Forbidden+Rites&type=Currency';

        ninja.overrides.set(url, { body: Buffer.from('{"unexpected":"shape"}') });

        const summary = await cycle();
        const broken = store.raws.find((raw) => raw.category === 'Currency')!;

        expect(summary).toMatchObject({ status: 'partial', parseErrors: 1, stored: 24 });
        expect(broken.parseError).toMatch(/^Unexpected exchange response/);
        expect(broken.parserVersion).toBeNull();
        expect(gunzipBody(broken.body)).toBe('{"unexpected":"shape"}');
    });

    it('counts a failed request, carries on, and ends partial', async () => {
        const { ninja, cycle } = setup();
        const url = 'https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Forbidden+Rites&type=Abyss';

        ninja.overrides.set(url, { status: 500 });

        const summary = await cycle();

        expect(summary).toMatchObject({ status: 'partial', fetchErrors: 1, stored: 23 });
    });

    it('fails when nothing can be fetched, with a short message', async () => {
        const { ninja, cycle } = setup();

        ninja.failWith = new Error('getaddrinfo ENOTFOUND poe.ninja');

        const summary = await cycle();

        expect(summary).toMatchObject({ status: 'failed', stored: 0 });
        expect(summary.error).toBe('No leagues to collect');
    });

    it('stops between requests once told to, recording why', async () => {
        const { ninja, store, cycle } = setup();
        const abort = new AbortController();
        const original = ninja.get.bind(ninja);

        ninja.get = async (url, etag) => {
            const result = await original(url, etag);

            if (ninja.calls.length === 3) abort.abort();

            return result;
        };

        const summary = await cycle(abort.signal);

        expect(summary).toMatchObject({ status: 'failed', error: 'Stopped before the cycle finished' });
        expect(summary.requests).toBe(3);
        expect(store.runs[0]?.summary?.status).toBe('failed');
    });

    it('records every cycle with its start and finish time', async () => {
        const { store, cycle } = setup();

        await cycle();

        expect(store.runs).toHaveLength(1);
        expect(store.runs[0]?.finishedAt).not.toBeNull();
        expect(store.runs[0]!.finishedAt!.getTime()).toBeGreaterThan(store.runs[0]!.startedAt.getTime());
    });
});
