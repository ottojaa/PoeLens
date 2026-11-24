import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import { ForbiddenError, UnauthorizedError } from '@poelens/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../../config/env.js';
import { db } from '../../db/kysely.js';
import type { Principal } from '../../services/api-tokens/index.js';
import { ACCESS_TOKEN_TTL_SECONDS } from '../../services/auth/tokens.js';

export interface AccessTokenPayload {
    /** The user's id. */
    sub: string;
    email: string;
    /** When the token was issued, in seconds since the epoch (set by the signer). */
    iat?: number;
}

export interface AuthUser {
    id: string;
    email: string;
}

/** The signed-in user of a request: the token's user, and when that token was issued (seconds since the epoch). */
export interface SessionUser extends AuthUser {
    issuedAt: number;
}

// Interface names in a module augmentation are flagged by no-unused-vars.
/* eslint-disable no-unused-vars */
declare module 'fastify' {
    interface FastifyRequest {
        /** Who an API token authenticated, on the routes that accept one (`/mcp`). Never set by a session: that is `user`. */
        principal: Principal | undefined;
    }

    interface FastifyInstance {
        /** preHandler/onRequest check: a valid access token in `Authorization: Bearer`. Sets `request.user`. */
        authenticate: (request: FastifyRequest) => Promise<void>;
        /** Run after `authenticate`: the user must be an active admin right now. */
        authenticateAdmin: (request: FastifyRequest) => Promise<void>;
        signAccessToken: (user: AuthUser) => string;
    }
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: AccessTokenPayload;
        user: SessionUser;
    }
}
/* eslint-enable no-unused-vars */

/**
 * Sessions. The access token is the only JWT; the refresh token is an opaque random value in the database (see
 * services/auth). `@fastify/jwt` is registered without its `cookie` option on purpose: `jwtVerify` then reads only the
 * Authorization header, so the refresh cookie can never act as a bearer token, and a refresh token (which is not a JWT)
 * fails verification wherever it is sent.
 *
 * The cookie plugin is unsigned: the refresh token's own 256 bits are the secret.
 */
export default fp(async function (fastify: FastifyInstance) {
    await fastify.register(fastifyCookie);
    await fastify.register(fastifyJwt, { secret: env.JWT_SECRET, sign: { expiresIn: ACCESS_TOKEN_TTL_SECONDS } });

    fastify.decorateRequest('principal', undefined);
    fastify.decorate('signAccessToken', (user: AuthUser) => fastify.jwt.sign({ sub: user.id, email: user.email }));

    // Does not read the database: deactivation and resets delete the refresh tokens, so access ends within the access
    // token's lifetime.
    fastify.decorate('authenticate', async function (request: FastifyRequest) {
        const payload = await request.jwtVerify<AccessTokenPayload>().catch(() => null);

        if (!payload?.sub) throw new UnauthorizedError('Sign in to continue', 'TOKEN_INVALID');

        request.user = { id: payload.sub, email: payload.email, issuedAt: payload.iat ?? 0 };
    });

    // Admin actions check the database each time: a demoted or deactivated admin loses them at once.
    fastify.decorate('authenticateAdmin', async function (request: FastifyRequest) {
        const admin = await db
            .selectFrom('users')
            .select('id')
            .where('id', '=', request.user.id)
            .where('role', '=', 'admin')
            .where('is_active', '=', true)
            .executeTakeFirst();

        if (!admin) throw new ForbiddenError('Admin access required');
    });
});
