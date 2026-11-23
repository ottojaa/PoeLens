import { createHash, randomBytes } from 'node:crypto';

/** How long an access token (the only JWT) lives. A deactivation or reset takes effect at most this long after it. */
export const ACCESS_TOKEN_TTL_SECONDS = 900;
export const REFRESH_TOKEN_TTL_DAYS = 7;
export const INVITE_TTL_DAYS = 7;
export const RESET_TTL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface OpaqueToken {
    /** What the holder carries: 32 random bytes, base64url. Never stored. */
    token: string;
    /** What the database stores and looks up. */
    hash: string;
}

export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

/** One random secret for every one-time or rotating token (refresh, invite, reset); 256 bits need no slow hash. */
export function generateToken(): OpaqueToken {
    const token = randomBytes(32).toString('base64url');

    return { token, hash: hashToken(token) };
}

export function expiresInDays(days: number, now: Date = new Date()): Date {
    return new Date(now.getTime() + days * DAY_MS);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
    return expiresAt.getTime() <= now.getTime();
}
