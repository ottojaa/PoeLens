import {
    IdParamsSchema,
    ResetLinkResponseSchema,
    UserSchema,
    UsersResponseSchema,
    type IdParams,
    type ResetLinkResponse,
    type User,
    type UsersResponse,
} from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/kysely.js';
import { deactivateUser, issueResetLink, listUsers, reactivateUser, toUser } from '../../../services/auth/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Reply: UsersResponse }>(
        '/users',
        { schema: { tags: ['admin'], description: 'Every account, oldest first', response: { 200: UsersResponseSchema } } },
        async () => ({ users: (await listUsers(db)).map(toUser) }),
    );

    fastify.post<{ Params: IdParams; Reply: User }>(
        '/users/:id/deactivate',
        {
            schema: {
                tags: ['admin'],
                description: 'Blocks sign-in and ends every session of the user (their access token still works for up to 15 minutes). Not allowed on yourself',
                params: IdParamsSchema,
                response: { 200: UserSchema },
            },
        },
        async (request) => toUser(await deactivateUser(db, request.user.id, request.params.id)),
    );

    fastify.post<{ Params: IdParams; Reply: User }>(
        '/users/:id/reactivate',
        { schema: { tags: ['admin'], description: 'Lets a deactivated user sign in again', params: IdParamsSchema, response: { 200: UserSchema } } },
        async (request) => toUser(await reactivateUser(db, request.params.id)),
    );

    fastify.post<{ Params: IdParams; Reply: ResetLinkResponse }>(
        '/users/:id/reset-link',
        {
            schema: {
                tags: ['admin'],
                description: 'A one-time link (7 days) for the user to set a new password; it replaces an earlier open link. The token is shown once',
                params: IdParamsSchema,
                response: { 200: ResetLinkResponseSchema },
            },
        },
        async (request) => issueResetLink(db, { userId: request.params.id, createdBy: request.user.id }),
    );
}
