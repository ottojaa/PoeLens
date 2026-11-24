// Shared error types: thrown by the backend, recognised by the clients.

export class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly details?: Record<string, unknown>;

    constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;

        if (details !== undefined) this.details = details;

        this.name = 'AppError';
    }

    toJSON() {
        return {
            statusCode: this.statusCode,
            error: this.code,
            message: this.message,
            details: this.details,
        };
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, id?: string) {
        super(404, 'NOT_FOUND', id ? `${resource} not found: ${id}` : `${resource} not found`);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(400, 'VALIDATION_ERROR', message, details);
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(409, 'CONFLICT', message);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string) {
        super(403, 'FORBIDDEN', message);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string, code = 'UNAUTHORIZED') {
        super(401, code, message);
    }
}

/** The error code of a refused add to a full watchlist, for clients to recognise. */
export const WATCHLIST_FULL_CODE = 'WATCHLIST_FULL';

export class WatchlistFullError extends AppError {
    constructor(limit: number) {
        super(409, WATCHLIST_FULL_CODE, 'The watchlist is full', { limit });
    }
}

/** The error code of a refused create at the API token limit, for clients to recognise. */
export const API_TOKENS_FULL_ERROR_CODE = 'API_TOKENS_FULL';

export class ApiTokensFullError extends AppError {
    constructor(limit: number) {
        super(409, API_TOKENS_FULL_ERROR_CODE, 'You have reached the limit of API tokens: revoke one first', { limit });
    }
}

/** The error code of a refused create at the dashboard limit, for clients to recognise. */
export const DASHBOARDS_FULL_CODE = 'DASHBOARDS_FULL';

export class DashboardsFullError extends AppError {
    constructor(limit: number) {
        super(409, DASHBOARDS_FULL_CODE, 'You have reached the limit of dashboards: delete one first', { limit });
    }
}

/** The error code of a save made on an out-of-date revision, for clients to recognise. */
export const DASHBOARD_CHANGED_CODE = 'DASHBOARD_CHANGED';

export class DashboardChangedError extends AppError {
    /** `current` is the dashboard as stored now, so the client can reload it or save over it. */
    constructor(current: unknown) {
        super(409, DASHBOARD_CHANGED_CODE, 'This dashboard changed in another tab', { current });
    }
}

export class TooManyRequestsError extends AppError {
    constructor(retryAfterSeconds: number) {
        super(429, 'RATE_LIMITED', 'Too many requests: retry in ' + retryAfterSeconds + ' seconds', { retryAfterSeconds });
    }
}
