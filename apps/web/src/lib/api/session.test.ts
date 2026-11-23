import { RefreshResponseSchema } from '@poelens/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fetchApi } from './client';
import { getAccessToken, onSessionExpired, refreshSession, setAccessToken } from './session';

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}

const REFRESHED = { accessToken: 'fresh-token', expiresIn: 900 };

beforeEach(() => {
    setAccessToken(null);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('refreshSession', () => {
    it('shares one request between callers that ask at the same time', async () => {
        const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(REFRESHED)));

        vi.stubGlobal('fetch', fetchMock);

        await expect(Promise.all([refreshSession(), refreshSession(), refreshSession()])).resolves.toEqual([true, true, true]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(getAccessToken()).toBe('fresh-token');

        await refreshSession();

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('sends the refresh cookie and reports no session on a 401', async () => {
        const fetchMock = vi.fn().mockResolvedValue(json({ error: 'REFRESH_INVALID' }, 401));

        vi.stubGlobal('fetch', fetchMock);

        await expect(refreshSession()).resolves.toBe(false);
        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', credentials: 'include' });
        expect(getAccessToken()).toBeNull();
    });

    it('throws on a server error, so a hiccup is not taken for a sign-out', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 503)));

        await expect(refreshSession()).rejects.toThrow('Session refresh failed: 503');
    });
});

describe('fetchApi with a session', () => {
    it('sends the access token, renews the session once on a 401 and repeats the request', async () => {
        setAccessToken('old-token');

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(json({ error: 'TOKEN_INVALID' }, 401))
            .mockResolvedValueOnce(json(REFRESHED))
            .mockResolvedValueOnce(json(REFRESHED));

        vi.stubGlobal('fetch', fetchMock);

        await expect(fetchApi('/prices/leagues', RefreshResponseSchema)).resolves.toEqual(REFRESHED);

        const sentWith = (call: number) => new Headers(fetchMock.mock.calls[call]?.[1]?.headers).get('authorization');

        expect(sentWith(0)).toBe('Bearer old-token');
        expect(fetchMock.mock.calls[1]?.[0]).toMatch(/\/auth\/refresh$/);
        expect(sentWith(2)).toBe('Bearer fresh-token');
    });

    it('signs the user out when the session cannot be renewed', async () => {
        setAccessToken('old-token');
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce(json({ error: 'TOKEN_INVALID' }, 401))
                .mockResolvedValueOnce(json({}, 401)),
        );

        const expired = vi.fn();
        const stop = onSessionExpired(expired);

        await expect(fetchApi('/prices/leagues', RefreshResponseSchema)).rejects.toMatchObject({ status: 401 });
        expect(expired).toHaveBeenCalledTimes(1);
        expect(getAccessToken()).toBeNull();
        stop();
    });

    it('leaves a 401 from a sign-in form alone: a wrong password is not an expired session', async () => {
        const fetchMock = vi.fn().mockResolvedValue(json({ error: 'INVALID_CREDENTIALS', message: 'Wrong email or password' }, 401));

        vi.stubGlobal('fetch', fetchMock);

        const error = await fetchApi('/auth/login', RefreshResponseSchema, { method: 'POST', json: { email: 'a@b.co' }, skipRefresh: true }).catch(
            (caught: unknown) => caught,
        );

        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', serverMessage: 'Wrong email or password' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ body: '{"email":"a@b.co"}', credentials: 'include' });
    });
});
