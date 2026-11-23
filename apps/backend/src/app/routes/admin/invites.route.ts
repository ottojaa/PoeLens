import {
    CreateInviteRequestSchema,
    CreateInviteResponseSchema,
    IdParamsSchema,
    InvitesResponseSchema,
    type CreateInviteRequest,
    type CreateInviteResponse,
    type IdParams,
    type InvitesResponse,
} from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/kysely.js';
import { createInvite, listOpenInvites, revokeInvite } from '../../../services/auth/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Reply: InvitesResponse }>(
        '/invites',
        { schema: { tags: ['admin'], description: 'Invites that can still be used', response: { 200: InvitesResponseSchema } } },
        async () => ({ invites: await listOpenInvites(db) }),
    );

    fastify.post<{ Body: CreateInviteRequest; Reply: CreateInviteResponse }>(
        '/invites',
        {
            schema: {
                tags: ['admin'],
                description: 'A single-use invite (7 days). The token is shown once; the admin page turns it into an /invite/<token> link',
                body: CreateInviteRequestSchema,
                response: { 200: CreateInviteResponseSchema },
            },
        },
        async (request) => createInvite(db, { role: request.body.role, createdBy: request.user.id }),
    );

    fastify.delete<{ Params: IdParams }>(
        '/invites/:id',
        { schema: { tags: ['admin'], description: 'Revokes an open invite', params: IdParamsSchema } },
        async (request, reply) => {
            await revokeInvite(db, request.params.id);

            return reply.status(204).send();
        },
    );
}
