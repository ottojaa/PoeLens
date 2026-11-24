import type { FastifyInstance, FastifyReply } from 'fastify';
import { handleMcpRequest } from '../../../mcp/handler.js';

export default async function (fastify: FastifyInstance) {
    // The MCP body is JSON-RPC: the SDK validates it, so no Fastify body schema.
    fastify.post('/', { schema: { hide: true } }, handleMcpRequest);

    // Stateless: there is no session to stream from or to end.
    const notAllowed = async (_request: unknown, reply: FastifyReply) =>
        reply.header('allow', 'POST').status(405).send({ statusCode: 405, error: 'METHOD_NOT_ALLOWED', message: 'Use POST' });

    fastify.get('/', { schema: { hide: true } }, notAllowed);
    fastify.delete('/', { schema: { hide: true } }, notAllowed);
}
