import { WATCHLIST_FULL_CODE } from '@poelens/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { FULL_LIST_MESSAGE, toToggleErrorMessage } from './messages';

describe('toToggleErrorMessage', () => {
    it('says the list is full for the WATCHLIST_FULL code', () => {
        const error = new ApiError(409, '/watchlist/1', WATCHLIST_FULL_CODE, null);

        expect(toToggleErrorMessage(error)).toBe(FULL_LIST_MESSAGE);
        expect(FULL_LIST_MESSAGE).toBe('Your watchlist is full (100 items). Remove one to add another.');
    });

    it('gives the generic message for any other failure', () => {
        const generic = "Couldn't update your watchlist. Try again.";

        expect(toToggleErrorMessage(new ApiError(500, '/watchlist/1', null, null))).toBe(generic);
        expect(toToggleErrorMessage(new ApiError(409, '/watchlist/1', 'OTHER', null))).toBe(generic);
        expect(toToggleErrorMessage(new Error('offline'))).toBe(generic);
    });
});
