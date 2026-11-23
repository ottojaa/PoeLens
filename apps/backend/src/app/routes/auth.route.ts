import { UnauthorizedError } from '@poelens/shared';
import {
    CurrentUserResponseSchema,
    LoginRequestSchema,
    LogoutResponseSchema,
    RefreshRequestSchema,
    RefreshResponseSchema,
    SessionResponseSchema,
    type CurrentUserResponse,
    type LoginRequest,
    type LogoutResponse,
    type RefreshRequest,
    type RefreshResponse,
    type SessionResponse,
} from '@poelens/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/kysely.js';
import {
    ACCESS_TOKEN_TTL_SECONDS,
    findUserById,
    login,
    revokeRefreshToken,
    rotateRefreshToken,
    toUser,
    type StartedSession,
} from '../../services/auth/index.js';
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from '../session-cookie.js';

// Per client address (the rightmost X-Forwarded-For entry, see server-options). Refresh is higher: the web app calls it
// on every page load and every expired access token.
const CREDENTIAL_LIMIT = { max: 30, timeWindow: '15 minutes' };
const REFRESH_LIMIT = { max: 120, timeWindow: '15 minutes' };

export default async function (fastify: FastifyInstance) {
    function toSession(reply: FastifyReply, started: StartedSession): SessionResponse {
        setRefreshCookie(reply, started.refreshToken);

        return {
            user: toUser(started.user),
            accessToken: fastify.signAccessToken(started.user),
            expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        };
    }

    fastify.post<{ Body: LoginRequest; Reply: SessionResponse }>(
        '/auth/login',
        {
            config: { rateLimit: CREDENTIAL_LIMIT },
            schema: {
                tags: ['auth'],
                description: 'Email and password. Every failure answers the same 401',
                body: LoginRequestSchema,
                response: { 200: SessionResponseSchema },
            },
        },
        async (request, reply) => {
            const started = await login(db, request.body.email, request.body.password);

            if (!started) throw new UnauthorizedError('Wrong email or password', 'INVALID_CREDENTIALS');

            return toSession(reply, started);
        },
    );

    fastify.post<{ Body: RefreshRequest; Reply: RefreshResponse }>(
        '/auth/refresh',
        {
            config: { rateLimit: REFRESH_LIMIT },
            schema: {
                tags: ['auth'],
                description: 'Spends the refresh token (cookie, or `refreshToken` in the body) and returns a new access token and a rotated refresh token',
                body: RefreshRequestSchema,
                response: { 200: RefreshResponseSchema },
            },
        },
        async (request, reply) => {
            const token = readRefreshToken(request, request.body);
            const started = token ? await rotateRefreshToken(db, token) : null;

            if (!started) {
                clearRefreshCookie(reply);

                throw new UnauthorizedError('Sign in to continue', 'REFRESH_INVALID');
            }

            const { accessToken, expiresIn } = toSession(reply, started);

            return { accessToken, expiresIn };
        },
    );

    fastify.post<{ Body: RefreshRequest; Reply: LogoutResponse }>(
        '/auth/logout',
        {
            config: { rateLimit: REFRESH_LIMIT },
            schema: {
                tags: ['auth'],
                description: 'Deletes the refresh token it receives and clears the cookie',
                body: RefreshRequestSchema,
                response: { 200: LogoutResponseSchema },
            },
        },
        async (request, reply) => {
            const token = readRefreshToken(request, request.body);

            if (token) await revokeRefreshToken(db, token);

            clearRefreshCookie(reply);

            return { success: true as const };
        },
    );

    fastify.get<{ Reply: CurrentUserResponse }>(
        '/auth/me',
        {
            onRequest: fastify.authenticate,
            schema: { tags: ['auth'], description: 'The signed-in user', response: { 200: CurrentUserResponseSchema } },
        },
        async (request) => {
            const user = await findUserById(db, request.user.id);

            // The account was deleted or deactivated since the access token was issued.
            if (!user?.is_active) throw new UnauthorizedError('Sign in to continue', 'TOKEN_INVALID');

            return { user: toUser(user) };
        },
    );
}
