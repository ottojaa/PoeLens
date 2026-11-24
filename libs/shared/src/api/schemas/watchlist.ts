import { z } from 'zod';
import { GameSchema } from '../../domain/game.js';
import { UnitSchema } from '../../domain/units.js';
import { ItemRefSchema, LeagueRefSchema, MAX_LATEST_ITEMS, TableRowSchema } from './prices.js';

/** The most items one user can watch: one priced answer for the whole list stays within a `latest` request's limit. */
export const MAX_WATCHLIST_ITEMS = MAX_LATEST_ITEMS;

/** The highest id a PostgreSQL `integer` column holds; a larger one in a URL is a bad request, not a database error. */
const MAX_ITEM_ID = 2_147_483_647;

export const WatchlistQuerySchema = z.object({
    game: GameSchema,
    league: z.string().min(1).default('current'),
    unit: UnitSchema.optional(),
});

export const WatchlistItemParamsSchema = z.object({
    itemId: z.coerce.number().int().positive().max(MAX_ITEM_ID),
});

/** A watched item's row in the league: always carries its sparkline, and low-confidence prices are included and flagged. */
export const WatchlistRowSchema = TableRowSchema.extend({
    addedAt: z.string().datetime(),
    sparkline: z.array(z.number()),
});

/** A watched item with no price in this league (not in its category's newest snapshot): it stays listed so it can be removed. */
export const WatchlistUnlistedSchema = z.object({
    item: ItemRefSchema,
    addedAt: z.string().datetime(),
});

export const WatchlistResponseSchema = z.object({
    game: GameSchema,
    league: LeagueRefSchema,
    unit: UnitSchema,
    rows: z.array(WatchlistRowSchema),
    unlisted: z.array(WatchlistUnlistedSchema),
});

export type WatchlistQuery = z.infer<typeof WatchlistQuerySchema>;
export type WatchlistItemParams = z.infer<typeof WatchlistItemParamsSchema>;
export type WatchlistRow = z.infer<typeof WatchlistRowSchema>;
export type WatchlistUnlisted = z.infer<typeof WatchlistUnlistedSchema>;
export type WatchlistResponse = z.infer<typeof WatchlistResponseSchema>;
