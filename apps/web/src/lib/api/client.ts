import type { z } from 'zod';

// A production build always has VITE_API_URL (vite.config.mts refuses to build without it); dev and tests use the local API.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3100';

/**
 * Fetches an API path and validates the JSON against the shared Zod contract, so a backend that drifts from the
 * contract fails here, loudly, instead of leaking `undefined`s into the UI. Throws on a non-2xx status or a body
 * that does not match.
 */
export async function fetchApi<T extends z.ZodTypeAny>(path: string, schema: T, init?: RequestInit): Promise<z.infer<T>> {
    const response = await fetch(API_URL + path, init);

    if (!response.ok) throw new Error('API request failed: ' + response.status + ' ' + path);

    return schema.parse(await response.json());
}
