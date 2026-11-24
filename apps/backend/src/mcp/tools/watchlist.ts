import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GameSchema, MAX_WATCHLIST_ITEMS, WatchlistFullError, type Game, type ItemRef, type WatchlistRow } from '@poelens/shared';
import { z } from 'zod';
import { getItemRows } from '../../services/prices/index.js';
import { countWatchedItems, getWatchlist, unwatchItem, watchItem } from '../../services/watchlist/index.js';
import { readDefaults, type ToolContext } from '../context.js';
import { runTool, textResult, ToolError } from '../errors.js';
import { describeItem, formatPriceLine, formatUnresolved, header, newestAsOf, withCredit } from '../format.js';
import { resolveLeagueArg } from '../leagues.js';
import { resolveItem } from '../resolve-item.js';

const WRITE = { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: false } as const;

/** How far an item moved over a day, for ordering: no known change sorts last. */
function movement(row: WatchlistRow): number {
    return row.change.h24 === null ? -1 : Math.abs(row.change.h24);
}

function registerGetWatchlist(server: McpServer, ctx: ToolContext) {
    server.registerTool(
        'get_watchlist',
        {
            title: 'Watchlist',
            description: "The caller's watchlist with current prices, the biggest 24h movers first. Items with no current price are named at the end.",
            inputSchema: {
                limit: z.number().int().min(1).max(MAX_WATCHLIST_ITEMS).default(25).describe('How many items at most.'),
                ...readDefaults,
            },
            annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
        },
        (args) =>
            runTool(async () => {
                const league = await resolveLeagueArg(ctx.db, args.game, args.league);
                const list = await getWatchlist(ctx.db, ctx.principal.userId, { game: args.game, league: league.name, unit: args.unit });
                const total = await countWatchedItems(ctx.db, ctx.principal.userId);
                const shown = [...list.rows].sort((a, b) => movement(b) - movement(a)).slice(0, args.limit);
                const now = ctx.now();
                const lines = shown.map((row) => formatPriceLine(row, now));
                const unlisted = list.unlisted.map((entry) => describeItem(entry.item) + ': no current price');
                const head = header({
                    game: list.game,
                    league: list.league,
                    unit: list.unit,
                    asOf: newestAsOf(list.rows),
                    now,
                    extra: `watching ${total} of ${MAX_WATCHLIST_ITEMS}`,
                });
                const empty = total === 0 ? ['The watchlist is empty. Use watch_item to add items.'] : [];

                return textResult(
                    withCredit([
                        head,
                        ...empty,
                        ...lines,
                        ...(list.rows.length > shown.length ? [`(${list.rows.length - shown.length} more not shown)`] : []),
                        ...unlisted,
                    ]),
                );
            }, ctx.log),
    );
}

/** The current price of an item in the current league, as one line (or why there is none). */
async function describeCurrent(ctx: ToolContext, game: Game, item: ItemRef): Promise<string> {
    const { rows } = await getItemRows(ctx.db, { game, league: 'current', unit: 'auto', itemIds: [item.id], includeLowConfidence: true, sparkline: false });
    const row = rows[0];

    return row ? formatPriceLine(row, ctx.now()) : `${describeItem(item)}: no current price`;
}

function registerWrite(server: McpServer, ctx: ToolContext, kind: 'watch' | 'unwatch') {
    const adding = kind === 'watch';

    server.registerTool(
        adding ? 'watch_item' : 'unwatch_item',
        {
            title: adding ? 'Add to watchlist' : 'Remove from watchlist',
            description: adding
                ? "Adds one item to the caller's watchlist (at most 100). Needs the exact item name or id: a name that is not exact adds nothing and lists candidates. Adding a watched item changes nothing."
                : "Removes one item from the caller's watchlist. Needs the exact item name or id: a name that is not exact removes nothing and lists candidates. Removing an item that is not watched changes nothing.",
            inputSchema: {
                item: z.string().trim().min(1).max(100).describe('The exact item name, or its numeric item id.'),
                game: GameSchema.default('poe2').describe('Which game the item is from.'),
            },
            annotations: WRITE,
        },
        (args) =>
            runTool(async () => {
                const resolution = await resolveItem(ctx.db, { game: args.game, text: args.item, guess: false });

                if (resolution.kind !== 'found') return textResult(formatUnresolved(args.item, resolution, 'write'));

                const userId = ctx.principal.userId;

                try {
                    await (adding ? watchItem(ctx.db, userId, resolution.item.id) : unwatchItem(ctx.db, userId, resolution.item.id));
                } catch (error) {
                    if (error instanceof WatchlistFullError) {
                        throw new ToolError(`The watchlist is full (${MAX_WATCHLIST_ITEMS} items): remove one with unwatch_item first. Nothing was added.`);
                    }

                    throw error;
                }

                const total = await countWatchedItems(ctx.db, userId);
                const verb = adding ? 'Watching' : 'No longer watching';
                const price = adding ? await describeCurrent(ctx, args.game, resolution.item) : describeItem(resolution.item);

                return textResult(withCredit([`${verb} ${resolution.item.name}. The watchlist now has ${total} of ${MAX_WATCHLIST_ITEMS} items.`, price]));
            }, ctx.log),
    );
}

export function registerWatchlistTools(server: McpServer, ctx: ToolContext) {
    registerGetWatchlist(server, ctx);
    registerWrite(server, ctx, 'watch');
    registerWrite(server, ctx, 'unwatch');
}
