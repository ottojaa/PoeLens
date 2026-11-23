import { RefreshResponseSchema } from '@poelens/shared';

// Same base URL rule as client.ts (which imports this module, so it cannot be shared from there).
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3100';

const REFRESH_LOCK = 'poelens-refresh';

/**
 * The access token lives in memory only: script injected into the page cannot read a refresh cookie (httpOnly), and a
 * token in localStorage would outlive the tab. A page load gets a new one from the refresh cookie.
 */
let accessToken: string | null = null;
let inFlight: Promise<boolean> | null = null;
const expiredListeners = new Set<() => void>();

export function getAccessToken(): string | null {
    return accessToken;
}

export function setAccessToken(token: string | null): void {
    accessToken = token;
}

/** Called when the session could not be renewed: the user has to sign in again. */
export function onSessionExpired(listener: () => void): () => void {
    expiredListeners.add(listener);

    return () => expiredListeners.delete(listener);
}

async function requestRefresh(): Promise<boolean> {
    const response = await fetch(API_URL + '/auth/refresh', { method: 'POST', credentials: 'include' });

    if (response.status === 401) return false;

    if (!response.ok) throw new Error('Session refresh failed: ' + response.status);

    accessToken = RefreshResponseSchema.parse(await response.json()).accessToken;

    return true;
}

// Refresh tokens are single-use. Two refreshes with the same cookie would make the second fail and sign the user out, so
// they run one at a time across tabs (the lock) and are shared within a tab (the in-flight promise: React StrictMode
// mounts effects twice, and several requests can hit a 401 together). The second tab then sends the cookie the first one
// already rotated.
async function refreshUnderLock(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.locks) return requestRefresh();

    // The lock's own type wraps the callback's promise once more than it does at run time; awaiting flattens it.
    return await navigator.locks.request(REFRESH_LOCK, requestRefresh);
}

/** Gets a new access token from the refresh cookie. False means there is no valid session (signed out, or expired). */
export function refreshSession(): Promise<boolean> {
    inFlight ??= refreshUnderLock().finally(() => {
        inFlight = null;
    });

    return inFlight;
}

/** Forgets the token and tells the auth context the user must sign in again. */
export function expireSession(): void {
    accessToken = null;
    expiredListeners.forEach((listener) => listener());
}
