import { createHash } from 'node:crypto';
import type { Fetcher } from './http.js';
import { gzipBody, gunzipBody, type CollectorStore, type NewRaw, type RunSummary } from './store.js';
import { ParseError, type RequestSpec, type SourceAdapter } from './types.js';

export interface CycleDeps {
    adapter: SourceAdapter;
    store: CollectorStore;
    fetcher: Fetcher;
    now?: () => Date;
    /** Aborts the cycle between requests (and the request in flight) when the process is shutting down. */
    signal?: AbortSignal;
}

class FetchError extends Error {}

const MAX_ERROR_LENGTH = 200;

function sha256(body: Buffer): string {
    return createHash('sha256').update(body).digest('hex');
}

/** A short message for the run record and /health: static text, the detail after a colon, never a stack. */
function toShortError(prefix: string, error: unknown): string {
    const detail = error instanceof Error ? error.message : String(error);

    return `${prefix}: ${detail}`.slice(0, MAX_ERROR_LENGTH);
}

interface Counts {
    requests: number;
    unchanged: number;
    stored: number;
    priceRows: number;
    parseErrors: number;
    fetchErrors: number;
}

/**
 * Fetches one request and, when its body is news, archives it and then parses it. The archive comes first: whatever the
 * parser does, the response is kept and can be parsed again.
 */
async function collectRequest(spec: RequestSpec, deps: CycleDeps, counts: Counts): Promise<void> {
    const { adapter, store, fetcher } = deps;
    const now = deps.now ?? (() => new Date());
    const latest = await store.findLatestRaw(adapter.source, adapter.game, spec);

    counts.requests += 1;

    const response = await fetcher.get(spec.url, latest?.etag ?? null, deps.signal).catch((error: unknown) => {
        throw new FetchError(toShortError('Request failed', error));
    });

    if (response.status === 304) {
        counts.unchanged += 1;

        return;
    }

    if (response.status !== 200) throw new FetchError('Unexpected status: ' + response.status);

    const hash = sha256(response.body);

    // The same body again: nothing to store, but the server may have a new ETag for it.
    if (latest && latest.sha256 === hash) {
        counts.unchanged += 1;

        if (latest.etag !== response.etag) await store.updateEtag(latest.id, response.etag);

        return;
    }

    const raw: NewRaw = {
        source: adapter.source,
        game: adapter.game,
        kind: spec.kind,
        league: spec.league,
        category: spec.category,
        url: spec.url,
        fetchedAt: now(),
        status: response.status,
        etag: response.etag,
        sha256: hash,
        body: gzipBody(response.body),
    };
    const id = await store.insertRaw(raw);

    counts.stored += 1;

    try {
        const facts = adapter.parse(spec, gunzipBody(raw.body));

        counts.priceRows += await store.applyFacts({ ...raw, id }, facts, adapter.parserVersion);
    } catch (error) {
        if (!(error instanceof ParseError)) throw error;

        counts.parseErrors += 1;
        await store.markParseError(id, error.message.slice(0, MAX_ERROR_LENGTH));
    }
}

/** Counts a failed request and carries on; anything that is not about this one request (the database) propagates. */
async function collectGuarded(spec: RequestSpec, deps: CycleDeps, counts: Counts): Promise<void> {
    try {
        await collectRequest(spec, deps, counts);
    } catch (error) {
        if (!(error instanceof FetchError)) throw error;

        counts.fetchErrors += 1;
    }
}

/** Returns why the cycle stopped early, or null when it ran every request. */
async function collectAll(deps: CycleDeps, counts: Counts): Promise<string | null> {
    const { adapter, store, signal } = deps;

    // The leagues come first so a brand-new league is collected in the same cycle it appears in.
    await collectGuarded(adapter.discover(), deps, counts);

    // Plans from the leagues already stored when discovery failed, so one bad leagues request never stops the cycle.
    const plan = adapter.plan(await store.loadLeagues(adapter.game));

    if (!plan.length) return 'No leagues to collect';

    for (const spec of plan) {
        if (signal?.aborted) return 'Stopped before the cycle finished';

        await collectGuarded(spec, deps, counts);
    }

    return null;
}

function toStatus(counts: Counts, stopped: string | null): RunSummary['status'] {
    if (stopped) return 'failed';

    if (counts.requests > 0 && counts.fetchErrors === counts.requests) return 'failed';

    return counts.parseErrors > 0 || counts.fetchErrors > 0 ? 'partial' : 'success';
}

/**
 * One collection cycle for one data source: discover the leagues, fetch every request politely, archive what changed and
 * write it. Records the run either way. Never throws: a failure is a `failed` run with a short error.
 */
export async function runCycle(deps: CycleDeps): Promise<RunSummary> {
    const { adapter, store } = deps;
    const now = deps.now ?? (() => new Date());
    const runId = await store.startRun(adapter.source, adapter.game, now());
    const counts: Counts = { requests: 0, unchanged: 0, stored: 0, priceRows: 0, parseErrors: 0, fetchErrors: 0 };
    let stopped: string | null = null;
    let error: string | null = null;

    try {
        stopped = await collectAll(deps, counts);
    } catch (caught) {
        error = toShortError('Cycle failed', caught);
    }

    const summary: RunSummary = { ...counts, status: error ? 'failed' : toStatus(counts, stopped), error: error ?? stopped };

    await store.finishRun(runId, now(), summary);

    return summary;
}
