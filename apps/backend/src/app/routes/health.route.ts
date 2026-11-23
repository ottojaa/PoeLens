import { HealthResponseSchema, type HealthResponse } from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { API_VERSION } from '../../config/version.js';
import { checkDbConnection, closeHealthProbe } from '../../db/health-probe.js';

const startTime = Date.now();

export default async function (fastify: FastifyInstance) {
    fastify.addHook('onClose', closeHealthProbe);

    fastify.get<{ Reply: HealthResponse }>(
        '/health',
        {
            schema: {
                description: 'Health check: the API answers, and whether it reaches the database ("degraded" when it does not)',
                response: { 200: HealthResponseSchema },
            },
        },
        async function () {
            const dbOk = await checkDbConnection();

            return {
                status: dbOk ? 'ok' : 'degraded',
                timestamp: new Date().toISOString(),
                version: API_VERSION,
                uptime: Math.floor((Date.now() - startTime) / 1000),
                services: { database: dbOk ? 'ok' : 'down' },
            };
        },
    );
}
