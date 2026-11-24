import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { toAddError } from './add-error';

describe('toAddError', () => {
    it("gives the server's reason for a refused request", () => {
        const refused = new ApiError(400, '/dashboards/d/blocks', 'VALIDATION_ERROR', 'The panel is full');

        expect(toAddError(refused, 'Trading')).toBe('Could not add it to Trading: The panel is full');
    });

    it('says to try again when the server failed or could not be reached', () => {
        const failed = new ApiError(500, '/dashboards/d/blocks', 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');

        expect(toAddError(failed, 'Trading')).toBe('Could not add it to Trading. Try again.');
        expect(toAddError(new TypeError('Failed to fetch'), 'Trading')).toBe('Could not add it to Trading. Try again.');
    });
});
