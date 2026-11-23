import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../../config/env.js';

/**
 * CORS plugin. Handles preflight OPTIONS and adds CORS headers to responses.
 * Required because the web app is served from a different origin than the API in development.
 */
export default fp(async function (fastify: FastifyInstance) {
    const origins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

    await fastify.register(cors, {
        origin: origins.length === 1 && origins[0] ? origins[0] : origins,
        credentials: true, // allow session cookies once accounts exist
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
});
