import { describe, expect, it } from 'vitest';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors.js';

describe('AppError family', () => {
    it('serialises to the wire format the clients read', () => {
        const error = new AppError(418, 'TEAPOT', 'Short and stout', { spout: true });

        expect(error.toJSON()).toEqual({ statusCode: 418, error: 'TEAPOT', message: 'Short and stout', details: { spout: true } });
    });

    it.each([
        [new NotFoundError('League', 'settlers'), 404, 'NOT_FOUND', 'League not found: settlers'],
        [new NotFoundError('League'), 404, 'NOT_FOUND', 'League not found'],
        [new ValidationError('Bad game'), 400, 'VALIDATION_ERROR', 'Bad game'],
        [new ConflictError('Already exists'), 409, 'CONFLICT', 'Already exists'],
        [new ForbiddenError('Not yet'), 403, 'FORBIDDEN', 'Not yet'],
    ])('%s maps to its status and code', (error, statusCode, code, message) => {
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(Error);
        expect(error.statusCode).toBe(statusCode);
        expect(error.code).toBe(code);
        expect(error.message).toBe(message);
    });
});
