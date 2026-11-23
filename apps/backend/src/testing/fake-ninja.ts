import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FetchResult, Fetcher } from '../collector/http.js';

const FIXTURES = join(__dirname, '../collector/sources/poe-ninja/fixtures');

/** A recorded poe.ninja response, trimmed (see the fixtures' README). */
export function fixture(name: string): Buffer {
    return readFileSync(join(FIXTURES, name));
}

export interface Call {
    url: string;
    etag: string | null;
}

/** A fake poe.ninja: serves the recorded fixtures, and answers 304 when asked with the ETag it handed out. */
export class FakeNinja implements Fetcher {
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
        const tag = `W/"${createHash('sha1').update(body).digest('hex').slice(0, 12)}-${this.etagSuffix}"`;

        if (etag === tag) return { status: 304, etag: tag, body: Buffer.alloc(0) };

        return { status: 200, etag: tag, body };
    }

    private bodyFor(url: string): Buffer {
        if (url.endsWith('/leagues')) return this.leagues;

        const type = new URL(url).searchParams.get('type') ?? '';

        return url.includes('/exchange/')
            ? toCategory(fixture('exchange-currency.json'), type, 'Currency')
            : toCategory(fixture('stash-unique-weapons.json'), type, 'UniqueWeapons');
    }
}

interface Keyed {
    id?: string | number;
    detailsId?: string;
}

/**
 * Every category answers with the same recorded fixture, so item keys would collide across categories. Other
 * categories get their keys suffixed with the category, which makes each one its own set of items.
 */
function toCategory(body: Buffer, type: string, recorded: string): Buffer {
    if (type === recorded) return body;

    const json = JSON.parse(body.toString('utf8')) as { core: { items: Keyed[] }; items?: Keyed[]; lines: Keyed[] };
    const suffix = (key: string) => `${key}~${type}`;

    const rename = (entry: Keyed) => {
        if (typeof entry.id === 'string') entry.id = suffix(entry.id);

        if (entry.detailsId) entry.detailsId = suffix(entry.detailsId);
    };

    [...json.core.items, ...(json.items ?? []), ...json.lines].forEach(rename);

    return Buffer.from(JSON.stringify(json));
}
