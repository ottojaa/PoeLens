import { TooManyRequestsError, UnauthorizedError } from '@poelens/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/kysely.js';
import { authenticateApiToken } from '../services/api-tokens/index.js';

/** The shape of a PoeLens API token in a header. Anything else (a session JWT, garbage) is refused before the database is asked. */
const TOKEN_HEADER = /^Bearer (pl_[A-Za-z0-9_-]{43})$/;

/** How many calls one token may make in a window: a model working through a question makes a handful. */
export const TOKEN_RATE_LIMIT = { max: 120, timeWindow: '1 minute' } as const;

function refuse(reply: FastifyReply): never {
    reply.header('www-authenticate', 'Bearer');

    throw new UnauthorizedError('Send an API token as: Authorization: Bearer <token>', 'UNAUTHORIZED');
}

/**
 * The checks in front of `/mcp`, in order (a route's own rate limit would run after them, hence they are run here):
 * 1. the per-IP limit the whole app has, so guessing tokens is throttled before any token is looked at;
 * 2. the header's shape, with no database call;
 * 3. the token itself: one query, nothing cached, so a revoked token or a deactivated user fails on the next call;
 * 4. a limit per token.
 * Both limiters are absent in development (the plugin is not registered there).
 */
export function addMcpAccessHooks(fastify: FastifyInstance): void {
    const perIp = fastify.hasDecorator('rateLimit') ? fastify.rateLimit() : undefined;
    const perToken = fastify.hasDecorator('createRateLimit')
        ? fastify.createRateLimit({ ...TOKEN_RATE_LIMIT, keyGenerator: (request) => request.principal?.credentialId ?? request.ip })
        : undefined;

    if (perIp) fastify.addHook('onRequest', perIp);

    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        const secret = TOKEN_HEADER.exec(request.headers.authorization ?? '')?.[1];

        if (!secret) return refuse(reply);

        request.principal = (await authenticateApiToken(db, secret)) ?? undefined;

        if (!request.principal) return refuse(reply);

        if (!perToken) return;

        const limit = await perToken(request);

        if (limit.isAllowed || !limit.isExceeded) return;

        reply.header('retry-after', limit.ttlInSeconds);

        throw new TooManyRequestsError(limit.ttlInSeconds);
    });
}
