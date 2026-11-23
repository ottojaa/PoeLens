import { createServer, type Server, type Socket } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../testing/build-app.js';

// The worst case for /health: a database that accepts the TCP connection and then never says a word.
const sockets = new Set<Socket>();
let hungDatabase: Server;
let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeAll(async () => {
    hungDatabase = createServer((socket) => {
        sockets.add(socket);
        socket.on('error', () => undefined);
        socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => hungDatabase.listen(0, '127.0.0.1', resolve));

    const address = hungDatabase.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    process.env.DATABASE_URL = `postgres://nobody:nobody@127.0.0.1:${port}/none`;
    app = await buildTestApp();
});

afterAll(async () => {
    await app.close();

    for (const socket of sockets) socket.destroy();

    await new Promise((resolve) => hungDatabase.close(resolve));
});

describe('GET /health with a hung database', () => {
    it('answers "degraded" in about 2 s, not never', async () => {
        const startedAt = Date.now();
        const res = await app.inject({ method: 'GET', url: '/health' });
        const elapsed = Date.now() - startedAt;

        expect(res.json()).toMatchObject({ status: 'degraded', services: { database: 'down' } });
        expect(elapsed).toBeLessThan(2_500);
    }, 5_000);
});
