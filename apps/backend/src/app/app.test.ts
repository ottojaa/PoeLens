import { HealthResponseSchema, NotFoundError } from '@poelens/shared';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import errorHandler from './plugins/error-handler.js';
import { buildTestApp } from '../testing/build-app.js';

// Nothing listens on port 1: Postgres is "down" for every test in this file.
process.env.DATABASE_URL = 'postgres://nobody:nobody@127.0.0.1:1/none';

let server: Awaited<ReturnType<typeof buildTestApp>>;

beforeAll(async () => {
    server = await buildTestApp();
});

afterAll(async () => {
    await server.close();
});

describe('GET /health with no database', () => {
    it('answers "degraded" with a body that satisfies the shared contract', async () => {
        const res = await server.inject({ method: 'GET', url: '/health' });

        expect(res.statusCode).toBe(200);

        const body = HealthResponseSchema.parse(res.json());

        expect(body.status).toBe('degraded');
        expect(body.services.database).toBe('down');
    });
});

describe('GET /docs', () => {
    it('serves Swagger UI and an OpenAPI document that lists /health', async () => {
        const ui = await server.inject({ method: 'GET', url: '/docs/' });
        const spec = await server.inject({ method: 'GET', url: '/docs/json' });

        expect(ui.statusCode).toBe(200);
        expect(ui.headers['content-type']).toContain('text/html');
        expect(spec.json().paths).toHaveProperty('/health');
    });
});

describe('error handler', () => {
    async function inject(url: string) {
        const isolated = Fastify();

        isolated.register(errorHandler);
        isolated.get('/missing', async () => {
            throw new NotFoundError('League', 'settlers');
        });
        isolated.get('/boom', async () => {
            throw new Error('database password is hunter2');
        });

        return isolated.inject({ method: 'GET', url });
    }

    it('maps an AppError to its status and wire format', async () => {
        const res = await inject('/missing');

        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ statusCode: 404, error: 'NOT_FOUND', message: 'League not found: settlers' });
    });

    it('hides the message of an unexpected error', async () => {
        const res = await inject('/boom');

        expect(res.statusCode).toBe(500);
        expect(res.body).not.toContain('hunter2');
        expect(res.json()).toMatchObject({ error: 'INTERNAL_SERVER_ERROR' });
    });
});
