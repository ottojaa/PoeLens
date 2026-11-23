import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/** Every admin route needs a signed-in user who is an active admin right now. See `prices/autohooks.ts` for why `fp`. */
export default fp(async function (fastify: FastifyInstance) {
    fastify.addHook('onRequest', fastify.authenticate);
    fastify.addHook('preHandler', fastify.authenticateAdmin);
});
