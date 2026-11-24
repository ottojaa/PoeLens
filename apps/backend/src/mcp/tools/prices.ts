import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HistoryQuerySchema, type Game, type ItemRef, type Unit, type UnitChoice } from '@poelens/shared';
import { z } from 'zod';
import { getHistory, getItemRows, searchItems } from '../../services/prices/index.js';
import { readDefaults, type ToolContext } from '../context.js';
import { runTool, textResult } from '../errors.js';
import { describeItem, formatNumber, formatPercent, formatPrice, formatPriceLine, formatUnresolved, header, newestAsOf, withCredit } from '../format.js';
import { resolveLeagueArg } from '../leagues.js';
import { resolveItem } from '../resolve-item.js';

const READ_ONLY = { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false } as const;

/** Hourly points up to this many days, daily points beyond: at most 48 points either way. */
const HOURLY_UP_TO_DAYS = 2;
const DAY_MS = 86_400_000;

interface Args {
    game: Game;
    league: string;
    unit: UnitChoice;
}

/** Prices of items (in input order), one line each, with the items that were not found or not priced named. */
async function describePrices(ctx: ToolContext, args: Args, items: ItemRef[]): Promise<string[]> {
    const { context, rows, unlistedIds } = await getItemRows(ctx.db, {
        game: args.game,
        league: args.league,
        unit: args.unit,
        itemIds: items.map((item) => item.id),
        includeLowConfidence: true,
        sparkline: false,
    });
    const byId = new Map(rows.map((row) => [row.item.id, row]));
    const unlisted = new Set(unlistedIds);
    const lines = items.map((item) => {
        const row = byId.get(item.id);

        if (row) return formatPriceLine(row, ctx.now());

        return `${describeItem(item)}: no current price${unlisted.has(item.id) ? ' (not in the latest poe.ninja snapshot)' : ''}`;
    });

    return [header({ game: context.game, league: context.league, unit: context.unit, asOf: newestAsOf(rows), now: ctx.now() }), ...lines];
}

function registerGetPrices(server: McpServer, ctx: ToolContext) {
    server.registerTool(
        'get_prices',
        {
            title: 'Current prices',
            description:
                'Current poe.ninja prices of up to 10 items by name or id: price, price in divine, 24h and 7d change, liquidity and age. Use for "what is X worth".',
            inputSchema: {
                items: z.array(z.string().trim().min(1).max(100)).min(1).max(10).describe('Item names (any case) or numeric item ids.'),
                ...readDefaults,
            },
            annotations: READ_ONLY,
        },
        (args) =>
            runTool(async () => {
                const league = await resolveLeagueArg(ctx.db, args.game, args.league);
                const found: ItemRef[] = [];
                const problems: string[] = [];

                for (const text of args.items) {
                    const resolution = await resolveItem(ctx.db, { game: args.game, text, guess: true });

                    if (resolution.kind === 'found') found.push(resolution.item);
                    else problems.push(formatUnresolved(text, resolution, 'read'));
                }

                const priced = found.length ? await describePrices(ctx, { ...args, league: league.name }, found) : [];

                return textResult(withCredit([...priced, ...problems]));
            }, ctx.log),
    );
}

function registerSearchItems(server: McpServer, ctx: ToolContext) {
    server.registerTool(
        'search_items',
        {
            title: 'Search items',
            description: 'Finds items by (part of) a name or base type, with their category, id and current price. Forgives typos.',
            inputSchema: {
                query: z.string().trim().min(2).max(100).describe('Part of an item name or base type.'),
                limit: z.number().int().min(1).max(20).default(8).describe('How many matches at most.'),
                ...readDefaults,
            },
            annotations: READ_ONLY,
        },
        (args) =>
            runTool(async () => {
                const league = await resolveLeagueArg(ctx.db, args.game, args.league);
                const { results } = await searchItems(ctx.db, { game: args.game, q: args.query, limit: args.limit });

                if (!results.length) return textResult(withCredit([`No item matches "${args.query}".`]));

                const lines = await describePrices(
                    ctx,
                    { ...args, league: league.name },
                    results.map((hit) => hit.item),
                );

                return textResult(withCredit(lines));
            }, ctx.log),
    );
}

function summarize(points: { price: number; low: number; high: number }[], unit: Unit): string {
    const first = points[0];
    const last = points[points.length - 1];

    if (!first || !last) return 'No prices in this range.';

    const change = first.price > 0 ? Math.round((last.price / first.price - 1) * 10_000) / 100 : null;
    const low = Math.min(...points.map((point) => point.low));
    const high = Math.max(...points.map((point) => point.high));

    return `${formatPrice(first.price, unit)} -> ${formatPrice(last.price, unit)} (${formatPercent(change)}), low ${formatPrice(low, unit)}, high ${formatPrice(high, unit)}`;
}

function registerGetPriceHistory(server: McpServer, ctx: ToolContext) {
    server.registerTool(
        'get_price_history',
        {
            title: 'Price history',
            description:
                'The price of one item over the last days: a summary (first, last, change, low, high) and up to 48 points (hourly up to 2 days, daily beyond).',
            inputSchema: {
                item: z.string().trim().min(1).max(100).describe('An item name or numeric item id.'),
                days: z.number().int().min(1).max(30).default(7).describe('How many days back.'),
                ...readDefaults,
            },
            annotations: READ_ONLY,
        },
        (args) =>
            runTool(async () => {
                const league = await resolveLeagueArg(ctx.db, args.game, args.league);
                const resolution = await resolveItem(ctx.db, { game: args.game, text: args.item, guess: true });

                if (resolution.kind !== 'found') return textResult(formatUnresolved(args.item, resolution, 'read'));

                const now = ctx.now();
                const query = HistoryQuerySchema.parse({
                    game: args.game,
                    league: league.name,
                    item: String(resolution.item.id),
                    unit: args.unit,
                    bucket: args.days <= HOURLY_UP_TO_DAYS ? 'hour' : 'day',
                    from: new Date(now.getTime() - args.days * DAY_MS).toISOString(),
                    to: now.toISOString(),
                });
                const history = await getHistory(ctx.db, query, now);
                const rows = history.points.map((point) => `${point.time.slice(0, 16).replace('T', ' ')} UTC  ${formatNumber(point.price)} ${history.unit}`);
                // An item that fell out of its category's newest snapshot has no latest row, but may still have history.
                const { rows: latest } = await getItemRows(ctx.db, {
                    game: args.game,
                    league: league.name,
                    unit: args.unit,
                    itemIds: [resolution.item.id],
                    includeLowConfidence: true,
                    sparkline: false,
                });

                return textResult(
                    withCredit([
                        header({
                            game: history.game,
                            league: history.league,
                            unit: history.unit,
                            asOf: newestAsOf(latest) ?? history.points.at(-1)?.time ?? null,
                            now,
                            extra: `${history.bucket === 'hour' ? 'hourly' : 'daily'} points, last ${args.days} d`,
                        }),
                        `${describeItem(history.item)}: ${summarize(history.points, history.unit)}`,
                        ...rows,
                    ]),
                );
            }, ctx.log),
    );
}

export function registerPriceTools(server: McpServer, ctx: ToolContext) {
    registerGetPrices(server, ctx);
    registerSearchItems(server, ctx);
    registerGetPriceHistory(server, ctx);
}
