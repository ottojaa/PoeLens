import type { z } from 'zod';
import { expireSession, getAccessToken, refreshSession } from './session';

// A production build always has VITE_API_URL (vite.config.mts refuses to build without it); dev and tests use the local API.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3100';

export interface ApiInit extends Omit<RequestInit, 'body'> {
    /** Sent as a JSON body. */
    json?: unknown;
    /** For the sign-in and link pages: a 401 there is a wrong answer, not an expired session. */
    skipRefresh?: boolean;
}

/** A non-2xx answer. `code` and `serverMessage` come from the API's error body when it has one. */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        path: string,
        readonly code: string | null,
        readonly serverMessage: string | null,
    ) {
        super('API request failed: ' + status + ' ' + path);
        this.name = 'ApiError';
    }
}

async function toApiError(response: Response, path: string): Promise<ApiError> {
    const body: unknown = await response.json().catch(() => null);
    const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

    return new ApiError(
        response.status,
        path,
        typeof fields['error'] === 'string' ? fields['error'] : null,
        typeof fields['message'] === 'string' ? fields['message'] : null,
    );
}

function send(path: string, { json, skipRefresh: _skip, ...init }: ApiInit): Promise<Response> {
    const headers = new Headers(init.headers);
    const token = getAccessToken();

    if (token) headers.set('authorization', 'Bearer ' + token);

    if (json !== undefined) headers.set('content-type', 'application/json');

    return fetch(API_URL + path, { ...init, headers, credentials: 'include', ...(json !== undefined ? { body: JSON.stringify(json) } : {}) });
}

/** Sends the request; on a 401 renews the session once and sends it again, and signs the user out if that fails. */
async function sendWithSession(path: string, init: ApiInit): Promise<Response> {
    const response = await send(path, init);

    if (response.status !== 401 || init.skipRefresh) return response;

    if (!(await refreshSession())) {
        expireSession();

        return response;
    }

    return send(path, init);
}

/**
 * Fetches an API path (signed in when there is a session) and validates the JSON against the shared Zod contract, so a
 * backend that drifts from the contract fails here, loudly, instead of leaking `undefined`s into the UI. Throws an
 * `ApiError` on a non-2xx status and a ZodError on a body that does not match.
 */
export async function fetchApi<T extends z.ZodTypeAny>(path: string, schema: T, init: ApiInit = {}): Promise<z.infer<T>> {
    const response = await sendWithSession(path, init);

    if (!response.ok) throw await toApiError(response, path);

    return schema.parse(await response.json());
}

/** For answers with no body (204). */
export async function sendApi(path: string, init: ApiInit = {}): Promise<void> {
    const response = await sendWithSession(path, init);

    if (!response.ok) throw await toApiError(response, path);
}
