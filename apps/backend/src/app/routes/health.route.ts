import { HealthResponseSchema, type HealthResponse } from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { API_VERSION } from '../../config/version.js';
import { env } from '../../config/env.js';
import { checkDbConnection, closeHealthProbe } from '../../db/health-probe.js';
import { probeCollectorRuns, toCollectorHealth } from '../../collector/health.js';
import { POE_NINJA_SOURCE } from '../../collector/sources/poe-ninja/poe2.js';

const startTime = Date.now();

export default async function (fastify: FastifyInstance) {
    fastify.addHook('onClose', closeHealthProbe);

    fastify.get<{ Reply: HealthResponse }>(
        '/health',
        {
            schema: {
                description:
                    'Health check: the API answers, whether it reaches the database, and how the price collector is doing ("degraded" when the database is down or an enabled collector is stale or had parse errors)',
                response: { 200: HealthResponseSchema },
            },
        },
        async function () {
            const dbOk = await checkDbConnection();
            // Skipped when the database just failed the probe: asking again would only double the wait.
            const runs = dbOk ? await probeCollectorRuns(POE_NINJA_SOURCE, 'poe2') : null;
            const collector = toCollectorHealth(env.COLLECTOR_ENABLED, runs, Date.now());
            const collectorDegraded = collector.status === 'degraded';

            return {
                status: dbOk && !collectorDegraded ? 'ok' : 'degraded',
                timestamp: new Date().toISOString(),
                version: API_VERSION,
                uptime: Math.floor((Date.now() - startTime) / 1000),
                services: { database: dbOk ? 'ok' : 'down', collector },
            };
        },
    );
}
