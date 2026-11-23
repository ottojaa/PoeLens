import { ApiError } from './client';

/** What a form shows for a failed request: the API's own message when it sent one, else a plain fallback. */
export function toFormError(error: unknown): string {
    if (error instanceof ApiError && error.serverMessage) return error.serverMessage;

    return error instanceof ApiError && error.status === 429 ? 'Too many attempts. Wait a few minutes and try again.' : "Can't reach the server. Try again.";
}
