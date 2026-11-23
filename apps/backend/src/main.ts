import Fastify from 'fastify';
import { app } from './app/app.js';
import { env } from './config/env.js';
import { checkDbConnection } from './db/health-probe.js';
import { closeDb, db } from './db/kysely.js';
import { startCollector } from './collector/start.js';

const LOGGER_BY_ENV = {
    development: {
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: true,
                ignore: 'pid,hostname,reqId,responseTime,req,res',
                messageFormat: '{msg} [id={reqId} {req.method} {req.url}] {res.statusCode}',
            },
        },
    },
    production: true,
    test: false,
};

async function main(): Promise<void> {
    const server = Fastify({ logger: LOGGER_BY_ENV[env.NODE_ENV] });

    server.register(app);

    let stopCollector: (() => Promise<void>) | undefined;

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.on(signal, async () => {
            server.log.info(`Received ${signal}, shutting down`);
            await server.close();
            // Before the database closes: a cycle in flight is still writing.
            await stopCollector?.();
            await closeDb();
            process.exit(0);
        });
    }

    await server.listen({ port: env.PORT, host: env.HOST });
    server.log.info(`API docs at http://${env.HOST}:${env.PORT}/docs`);

    // After listen, so a slow or missing database never delays the API coming up.
    const dbUp = await checkDbConnection();

    if (env.COLLECTOR_ENABLED) {
        stopCollector = startCollector({ db, log: server.log });
        server.log.info('Price collector enabled');
    }

    if (dbUp) server.log.info('Database connection established');
    else server.log.warn('Database connection failed: /health reports "degraded" until it comes back');
}

main().catch((error: unknown) => {
    console.error('Server failed to start:', error);
    process.exit(1);
});
