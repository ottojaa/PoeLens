import {
    CreateDashboardBodySchema,
    DashboardDataBodySchema,
    DashboardDataResponseSchema,
    DashboardOrderBodySchema,
    DashboardParamsSchema,
    DashboardSchema,
    DashboardsQuerySchema,
    DashboardsResponseSchema,
    SaveDashboardBodySchema,
    type CreateDashboardBody,
    type Dashboard,
    type DashboardDataBody,
    type DashboardDataResponse,
    type DashboardOrderBody,
    type DashboardParams,
    type DashboardsQuery,
    type DashboardsResponse,
    type SaveDashboardBody,
} from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/kysely.js';
import { createDashboard, deleteDashboard, getDashboardData, listDashboards, reorderDashboards, saveDashboard } from '../../../services/dashboards/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: DashboardsQuery; Reply: DashboardsResponse }>(
        '/',
        {
            schema: {
                tags: ['dashboards'],
                description:
                    "The signed-in user's dashboards of a game in tab order. A user who has saved none gets the starter dashboard at revision 0; reading never stores anything",
                querystring: DashboardsQuerySchema,
                response: { 200: DashboardsResponseSchema },
            },
        },
        async (request) => listDashboards(db, request.user.id, request.query.game),
    );

    fastify.post<{ Body: CreateDashboardBody; Reply: Dashboard }>(
        '/',
        {
            schema: {
                tags: ['dashboards'],
                description: 'Adds an empty dashboard after the others. Ten per game: the next answers 409 DASHBOARDS_FULL',
                body: CreateDashboardBodySchema,
                response: { 201: DashboardSchema },
            },
        },
        async (request, reply) => reply.status(201).send(await createDashboard(db, request.user.id, request.body)),
    );

    fastify.put<{ Body: DashboardOrderBody }>(
        '/order',
        {
            schema: {
                tags: ['dashboards'],
                description: "Sets the tab order of a game's dashboards. The ids must be exactly the user's dashboards of the game",
                body: DashboardOrderBodySchema,
            },
        },
        async (request, reply) => {
            await reorderDashboards(db, request.user.id, request.body);

            return reply.status(204).send();
        },
    );

    fastify.post<{ Body: DashboardDataBody; Reply: DashboardDataResponse }>(
        '/data',
        {
            schema: {
                tags: ['dashboards'],
                description:
                    'The prices behind the item and pair blocks of a set of panels, by block id. Only what the blocks point at is sent: layout, notes and names are not part of the request',
                body: DashboardDataBodySchema,
                response: { 200: DashboardDataResponseSchema },
            },
        },
        async (request) => getDashboardData(db, request.body),
    );

    fastify.put<{ Params: DashboardParams; Body: SaveDashboardBody; Reply: Dashboard }>(
        '/:id',
        {
            schema: {
                tags: ['dashboards'],
                description:
                    "Saves a dashboard's name and panels, laid out without overlaps. The body's revision must be the stored one, or the answer is 409 DASHBOARD_CHANGED with the stored dashboard. The starter's id works before it has been stored",
                params: DashboardParamsSchema,
                body: SaveDashboardBodySchema,
                response: { 200: DashboardSchema },
            },
        },
        async (request) => saveDashboard(db, request.user.id, request.params.id, request.body),
    );

    fastify.delete<{ Params: DashboardParams }>(
        '/:id',
        {
            schema: {
                tags: ['dashboards'],
                description: 'Deletes a dashboard. Deleting the last one brings the starter back on the next read',
                params: DashboardParamsSchema,
            },
        },
        async (request, reply) => {
            await deleteDashboard(db, request.user.id, request.params.id);

            return reply.status(204).send();
        },
    );
}
