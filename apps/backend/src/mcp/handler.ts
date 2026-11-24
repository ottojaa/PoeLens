import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/kysely.js';
import { createMcpServer } from './server.js';

const INTERNAL_ERROR = { jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null };

/**
 * Answers one MCP request. The transport is stateless (no session id, plain JSON answers): a server and a transport live
 * for this request only, and are closed when the response ends.
 *
 * The SDK writes to the raw Node response, so the reply is hijacked: Fastify no longer sends it, and neither its error
 * handler nor its onSend hooks run. The headers set through `reply.header()` so far (the rate limiter's, CORS) are copied
 * onto the raw response first, because they would be lost otherwise; helmet writes to the raw response itself. A throw
 * after the hijack gets a generic JSON-RPC error, never the error's own text.
 */
export async function handleMcpRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = request.principal;

    if (!principal) throw new Error('Missing principal: the access hooks did not run');

    const server = createMcpServer({ db, principal, log: (error) => request.log.error({ err: error }, 'MCP tool failed') });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });

    reply.raw.on('close', () => {
        void transport.close();
        void server.close();
    });

    for (const [name, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined) reply.raw.setHeader(name, value);
    }

    reply.hijack();

    try {
        await server.connect(transport);
        await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (error) {
        request.log.error({ err: error }, 'MCP request failed');

        if (reply.raw.headersSent) return void reply.raw.end();

        reply.raw.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify(INTERNAL_ERROR));
    }
}
