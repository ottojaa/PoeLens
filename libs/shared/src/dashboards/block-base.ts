import { z } from 'zod';

/** The highest id a PostgreSQL `integer` column holds; a larger one is a bad request, not a database error. */
const MAX_ITEM_ID = 2_147_483_647;

export const ItemIdSchema = z.number().int().positive().max(MAX_ITEM_ID);

/** A block's id: made by the client, unique within its dashboard. The data response is keyed by it. */
export const BlockIdSchema = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'Expected letters, digits, - and _');

/** The longest display name a block can carry. */
export const MAX_BLOCK_NAME = 60;
export const MAX_NOTE_LENGTH = 4000;
export const MAX_HEADING_LENGTH = 80;

/** What every block carries: its id and the version of its own schema. */
export const blockBase = { id: BlockIdSchema, v: z.literal(1) };

/** A display name that replaces the block's own title when set. */
export const blockName = z.string().trim().max(MAX_BLOCK_NAME).optional();
