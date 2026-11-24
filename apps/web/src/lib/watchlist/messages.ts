import { MAX_WATCHLIST_ITEMS, WATCHLIST_FULL_CODE } from '@poelens/shared';
import { ApiError } from '@/lib/api/client';

/** What the toast says when the list is full. */
export const FULL_LIST_MESSAGE = `Your watchlist is full (${MAX_WATCHLIST_ITEMS} items). Remove one to add another.`;

/** What the toast says when a toggle fails: the list is full, or anything else. */
export function toToggleErrorMessage(error: unknown): string {
    if (error instanceof ApiError && error.code === WATCHLIST_FULL_CODE) return FULL_LIST_MESSAGE;

    return "Couldn't update your watchlist. Try again.";
}
