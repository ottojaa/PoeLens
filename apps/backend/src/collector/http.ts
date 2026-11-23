/** What one conditional GET returned. `body` is empty for a 304. */
export interface FetchResult {
    status: number;
    etag: string | null;
    body: Buffer;
}

export interface Fetcher {
    /** Sends a GET with `If-None-Match` when an ETag is given. Throws only when no response arrives (network, timeout, abort). */
    get(url: string, etag: string | null, signal?: AbortSignal): Promise<FetchResult>;
}

export interface FetcherOptions {
    userAgent: string;
    /** The pause between the end of one request and the start of the next. */
    gapMs?: number;
    timeoutMs?: number;
    /** Replaceable so tests need no network and no real waiting. */
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
}

export const DEFAULT_GAP_MS = 2_500;
export const DEFAULT_TIMEOUT_MS = 30_000;

function defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The only way the collector talks to a data source. It is polite by construction: one request at a time (callers
 * queue), a pause after each, a User-Agent that says who is asking and how to reach them, and conditional requests.
 */
export function createFetcher(options: FetcherOptions): Fetcher {
    const gapMs = options.gapMs ?? DEFAULT_GAP_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const fetchImpl = options.fetchImpl ?? fetch;
    const sleep = options.sleep ?? defaultSleep;
    const now = options.now ?? Date.now;
    let queue: Promise<unknown> = Promise.resolve();
    let lastFinishedAt: number | null = null;

    async function send(url: string, etag: string | null, signal?: AbortSignal): Promise<FetchResult> {
        if (lastFinishedAt !== null) {
            const wait = lastFinishedAt + gapMs - now();

            if (wait > 0) await sleep(wait);
        }

        const headers: Record<string, string> = { 'user-agent': options.userAgent, accept: 'application/json' };

        if (etag) headers['if-none-match'] = etag;

        const timeout = AbortSignal.timeout(timeoutMs);

        try {
            const response = await fetchImpl(url, { headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });

            return { status: response.status, etag: response.headers.get('etag'), body: Buffer.from(await response.arrayBuffer()) };
        } finally {
            lastFinishedAt = now();
        }
    }

    return {
        get(url, etag, signal) {
            const result = queue.then(() => send(url, etag, signal));

            // The next caller waits for this one to finish, whether it succeeded or not.
            queue = result.catch(() => undefined);

            return result;
        },
    };
}
