import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { toAddError } from './add-error';

const answer = (status: number, code: string, message: string) => new ApiError(status, '/dashboards/d/blocks', code, message);

describe('toAddError', () => {
    it("gives the server's reason for a refused block", () => {
        const refused = answer(400, 'VALIDATION_ERROR', 'The panel is full: remove a block first');

        expect(toAddError(refused, 'Trading')).toBe('Could not add it to Trading: The panel is full: remove a block first');
    });

    it('says a missing dashboard or panel is gone, without its id', () => {
        const missing = answer(404, 'NOT_FOUND', 'Panel not found: p-1');

        expect(toAddError(missing, 'Trading')).toBe('Could not add it to Trading: the dashboard or panel is no longer there.');
    });

    it('says to try again when the server was busy, failed or could not be reached', () => {
        const tryAgain = 'Could not add it to Trading. Try again.';

        expect(toAddError(answer(429, 'FST_ERR_RATE_LIMIT', 'Rate limit exceeded'), 'Trading')).toBe(tryAgain);
        expect(toAddError(answer(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred'), 'Trading')).toBe(tryAgain);
        expect(toAddError(new TypeError('Failed to fetch'), 'Trading')).toBe(tryAgain);
    });
});
