import {
    InvitePreviewSchema,
    LogoutResponseSchema,
    RegisterRequestSchema,
    ResetPasswordRequestSchema,
    SessionResponseSchema,
    TokenParamsSchema,
    type InvitePreview,
    type LogoutResponse,
    type RegisterRequest,
    type ResetPasswordRequest,
    type SessionResponse,
    type TokenParams,
} from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/kysely.js';
import { ACCESS_TOKEN_TTL_SECONDS, previewInvite, redeemInvite, redeemReset, toUser } from '../../services/auth/index.js';
import { invalidLinkError } from '../../services/auth/link-errors.js';
import { setRefreshCookie } from '../session-cookie.js';

const LINK_LIMIT = { max: 30, timeWindow: '15 minutes' };

/** The pages behind an invite link or a reset link: open to signed-out visitors, so they are rate limited per address. */
export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: TokenParams; Reply: InvitePreview }>(
        '/auth/invites/:token',
        {
            config: { rateLimit: LINK_LIMIT },
            schema: {
                tags: ['auth'],
                description: 'What an invite link is for, before the form is filled in',
                params: TokenParamsSchema,
                response: { 200: InvitePreviewSchema },
            },
        },
        async (request) => {
            const preview = await previewInvite(db, request.params.token);

            if (!preview) throw invalidLinkError('invite');

            return preview;
        },
    );

    fastify.post<{ Body: RegisterRequest; Reply: SessionResponse }>(
        '/auth/register',
        {
            config: { rateLimit: LINK_LIMIT },
            schema: {
                tags: ['auth'],
                description: 'Spends an invite to create the account it is for, and signs it in',
                body: RegisterRequestSchema,
                response: { 200: SessionResponseSchema },
            },
        },
        async (request, reply) => {
            const started = await redeemInvite(db, request.body);

            setRefreshCookie(reply, started.refreshToken);

            return { user: toUser(started.user), accessToken: fastify.signAccessToken(started.user), expiresIn: ACCESS_TOKEN_TTL_SECONDS };
        },
    );

    fastify.post<{ Body: ResetPasswordRequest; Reply: LogoutResponse }>(
        '/auth/reset',
        {
            config: { rateLimit: LINK_LIMIT },
            schema: {
                tags: ['auth'],
                description: 'Spends an admin-issued reset link to set a new password and ends every session of the user. Does not sign in',
                body: ResetPasswordRequestSchema,
                response: { 200: LogoutResponseSchema },
            },
        },
        async (request) => {
            await redeemReset(db, request.body);

            return { success: true as const };
        },
    );
}
