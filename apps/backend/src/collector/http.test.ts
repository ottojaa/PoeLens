import { describe, expect, it, vi } from 'vitest';
import { createFetcher } from './http.js';

function jsonResponse(status = 200, etag: string | null = null): Response {
    return new Response(status === 304 ? null : '{"ok":true}', { status, headers: etag ? { etag } : {} });
}

function setup(responses: Response[] = []) {
    let clock = 1_000_000;
    const sleeps: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
    });
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => responses.shift() ?? jsonResponse());
    const fetcher = createFetcher({
        userAgent: 'PoeLens/0.0.1 (+https://example.test)',
        gapMs: 2_500,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep,
        now: () => clock,
    });

    return { fetcher, fetchImpl, sleeps, advance: (ms: number) => (clock += ms) };
}

describe('createFetcher', () => {
    it('sends the User-Agent with a contact, and If-None-Match only when it has an ETag', async () => {
        const { fetcher, fetchImpl } = setup();

        await fetcher.get('https://poe.ninja/a', null);
        await fetcher.get('https://poe.ninja/a', 'W/"abc"');

        const [first, second] = fetchImpl.mock.calls.map(([, init]) => init?.headers as Record<string, string>);

        expect(first?.['user-agent']).toBe('PoeLens/0.0.1 (+https://example.test)');
        expect(first).not.toHaveProperty('if-none-match');
        expect(second?.['if-none-match']).toBe('W/"abc"');
    });

    it('returns the status, the ETag and the body, and an empty body for a 304', async () => {
        const { fetcher } = setup([jsonResponse(200, 'W/"v1"'), jsonResponse(304)]);
        const ok = await fetcher.get('https://poe.ninja/a', null);
        const unchanged = await fetcher.get('https://poe.ninja/a', 'W/"v1"');

        expect(ok).toMatchObject({ status: 200, etag: 'W/"v1"' });
        expect(ok.body.toString()).toBe('{"ok":true}');
        expect(unchanged).toMatchObject({ status: 304, etag: null });
        expect(unchanged.body).toHaveLength(0);
    });

    it('waits out the gap between requests, but not before the first and not when the gap has already passed', async () => {
        const { fetcher, sleeps, advance } = setup();

        await fetcher.get('https://poe.ninja/a', null);
        expect(sleeps).toEqual([]);

        await fetcher.get('https://poe.ninja/b', null);
        expect(sleeps).toEqual([2_500]);

        advance(10_000);
        await fetcher.get('https://poe.ninja/c', null);
        expect(sleeps).toEqual([2_500]);
    });

    it('never has two requests in flight at once, however many callers ask together', async () => {
        let inFlight = 0;
        let peak = 0;
        const fetchImpl = vi.fn(async () => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight -= 1;

            return jsonResponse();
        });
        const fetcher = createFetcher({ userAgent: 'x', gapMs: 0, fetchImpl: fetchImpl as unknown as typeof fetch });

        await Promise.all(['a', 'b', 'c', 'd'].map((path) => fetcher.get('https://poe.ninja/' + path, null)));

        expect(fetchImpl).toHaveBeenCalledTimes(4);
        expect(peak).toBe(1);
    });

    it('lets the next request through after one fails, still after the gap', async () => {
        const { fetcher, fetchImpl, sleeps } = setup();

        fetchImpl.mockRejectedValueOnce(new Error('network down'));

        await expect(fetcher.get('https://poe.ninja/a', null)).rejects.toThrow('network down');
        await expect(fetcher.get('https://poe.ninja/b', null)).resolves.toMatchObject({ status: 200 });
        expect(sleeps).toEqual([2_500]);
    });
});
