import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { REFRESH_TOKEN_TTL_DAYS } from '../services/auth/tokens.js';

export const REFRESH_COOKIE = 'refresh_token';

// Only the /auth routes (refresh and logout) ever see the cookie: it is not sent with price or admin requests.
const COOKIE_PATH = '/auth';

const SECONDS_PER_DAY = 24 * 60 * 60;

/**
 * The refresh token's cookie. httpOnly keeps it from page scripts; lax (poelens.com and api.poelens.com are same-site)
 * keeps other sites from making the browser send it on a cross-site POST. The Android client reads the rotated token
 * from Set-Cookie.
 */
export function setRefreshCookie(reply: FastifyReply, token: string): void {
    reply.setCookie(REFRESH_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        path: COOKIE_PATH,
        maxAge: REFRESH_TOKEN_TTL_DAYS * SECONDS_PER_DAY,
    });
}

export function clearRefreshCookie(reply: FastifyReply): void {
    reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
}

/** The refresh token a request carries: the cookie, or a body field for clients without a cookie jar. */
export function readRefreshToken(request: FastifyRequest, body: { refreshToken?: string } | null | undefined): string | undefined {
    return request.cookies[REFRESH_COOKIE] ?? body?.refreshToken;
}
