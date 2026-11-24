import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * The one access check in front of every `/me` route (autoload applies this file to each route in this folder): a
 * signed-in session. An API token is not a session, so it cannot read or change the user's preferences.
 *
 * Wrapped in `fp` so the hook is not encapsulated away from the routes: autoload marks a plain function that way itself,
 * but not when it loads the file as an ES module (which it does under Vitest), where the hook would silently apply to
 * nothing.
 */
export default fp(async function (fastify: FastifyInstance) {
    fastify.addHook('onRequest', fastify.authenticate);
});
