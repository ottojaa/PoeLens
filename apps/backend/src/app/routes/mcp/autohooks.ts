import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { addMcpAccessHooks } from '../../../mcp/access.js';

/**
 * The one access check in front of every `/mcp` route (autoload applies this file to each route in this folder): an API
 * token, never a session. See `mcp/access.ts`. Wrapped in `fp` for the reason given in `prices/autohooks.ts`.
 */
export default fp(async function (fastify: FastifyInstance) {
    addMcpAccessHooks(fastify);
});
