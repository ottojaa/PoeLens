import { ForbiddenError } from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../../../config/env.js';

/**
 * The one access check in front of every price route (autoload applies this file to each route in this folder). The app
 * is invite-only and poe.ninja asks that its API is not used to replicate their site, so production serves no price API
 * until there are accounts to check; dev and tests are open.
 *
 * Wrapped in `fp` so the hook is not encapsulated away from the routes: autoload marks a plain function that way itself,
 * but not when it loads the file as an ES module (which it does under Vitest), where the hook would silently apply to
 * nothing.
 */
export default fp(async function (fastify: FastifyInstance) {
    fastify.addHook('onRequest', async () => {
        if (env.NODE_ENV === 'production') throw new ForbiddenError('Price data is not available yet');
    });
});
