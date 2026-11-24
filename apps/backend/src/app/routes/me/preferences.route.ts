import { PreferencesSchema, type Preferences } from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/kysely.js';
import { getPreferences, updatePreferences } from '../../../services/preferences/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Reply: Preferences }>(
        '/preferences',
        {
            schema: {
                tags: ['me'],
                description: "The signed-in user's saved preferences (theme, mode, unit). A key that was never set is absent",
                response: { 200: PreferencesSchema },
            },
        },
        async (request) => getPreferences(db, request.user.id),
    );

    fastify.patch<{ Body: Preferences; Reply: Preferences }>(
        '/preferences',
        {
            schema: {
                tags: ['me'],
                description: "Merges the given keys into the signed-in user's preferences and answers with all of them. Keys left out are unchanged",
                body: PreferencesSchema,
                response: { 200: PreferencesSchema },
            },
        },
        async (request) => updatePreferences(db, request.user.id, request.body),
    );
}
