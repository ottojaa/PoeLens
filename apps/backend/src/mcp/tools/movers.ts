import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CATEGORIES, DEFAULT_UNIT, MOVER_WINDOWS, type Game, type PriceRow } from '@poelens/shared';
import { z } from 'zod';
import { getMoversIn } from '../../services/prices/index.js';
import { toAutoRow } from '../../services/prices/display-unit.js';
import { readDefaults, type ToolContext } from '../context.js';
import { runTool, textResult, ToolError } from '../errors.js';
import { formatPercent, formatPriceLine, header, newestAsOf, withCredit } from '../format.js';
import { resolveLeagueArg } from '../leagues.js';

const GROUPS = ['all', 'uniques', 'economy'] as const;

/** The categories a `category` argument means: undefined for all of them, the group's, or the one named. */
function toCategories(game: Game, category: string): string[] | undefined {
    if (category === 'all') return undefined;

    const all = CATEGORIES[game];
    const inGroup = all.filter((entry) => entry.group === category).map((entry) => entry.id);

    if (inGroup.length || GROUPS.some((group) => group === category)) return inGroup;

    const match = all.find((entry) => entry.id.toLowerCase() === category.toLowerCase());

    if (match) return [match.id];

    throw new ToolError(`Unknown category "${category}". Use all, uniques, economy or one of: ${all.map((entry) => entry.id).join(', ')}.`);
}

function section(title: string, rows: PriceRow[], window: (typeof MOVER_WINDOWS)[number], now: Date): string[] {
    if (!rows.length) return [`${title}: none`];

    const key = { '1h': 'h1', '24h': 'h24', '7d': 'd7' }[window] as 'h1' | 'h24' | 'd7';

    return [`${title}:`, ...rows.map((row, index) => `${index + 1}. [${window} ${formatPercent(row.change[key])}] ${formatPriceLine(row, now)}`)];
}

export function registerMoverTools(server: McpServer, ctx: ToolContext) {
    server.registerTool(
        'get_top_movers',
        {
            title: 'Top movers',
            description:
                'The biggest risers and fallers of the latest prices over 1h, 24h or 7d, in all categories, in the uniques or economy group, or in one category. Low-confidence prices are left out.',
            inputSchema: {
                category: z.string().trim().min(1).max(60).default('all').describe('all (default), uniques, economy, or a category id such as UniqueWeapons.'),
                window: z.enum(MOVER_WINDOWS).default('24h').describe('The window the change is over.'),
                limit: z.number().int().min(1).max(20).default(5).describe('How many risers and how many fallers.'),
                game: readDefaults.game,
                league: readDefaults.league,
            },
            annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false },
        },
        (args) =>
            runTool(async () => {
                const league = await resolveLeagueArg(ctx.db, args.game, args.league);
                const result = await getMoversIn(ctx.db, {
                    game: args.game,
                    league: league.name,
                    categories: toCategories(args.game, args.category),
                    window: args.window,
                    limit: args.limit,
                    includeLowConfidence: false,
                });
                const now = ctx.now();
                const fixed = DEFAULT_UNIT[args.game];
                const risers = result.risers.map((row) => toAutoRow(row, args.game));
                const fallers = result.fallers.map((row) => toAutoRow(row, args.game));
                const head = header({
                    game: result.game,
                    league: result.league,
                    unit: 'auto',
                    asOf: newestAsOf([...result.risers, ...result.fallers]),
                    now,
                    extra: `${args.category}, ${args.window}; changes are measured and ranked in ${fixed}, so they compare across items`,
                });

                return textResult(withCredit([head, ...section('Risers', risers, args.window, now), ...section('Fallers', fallers, args.window, now)]));
            }, ctx.log),
    );
}
