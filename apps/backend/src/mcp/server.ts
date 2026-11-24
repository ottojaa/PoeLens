import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import type { Principal } from '../services/api-tokens/index.js';
import type { ToolContext } from './context.js';
import { registerMoverTools } from './tools/movers.js';
import { registerPriceTools } from './tools/prices.js';
import { registerWatchlistTools } from './tools/watchlist.js';

const INSTRUCTIONS = [
    "PoeLens: Path of Exile economy prices (from poe.ninja) and the caller's own watchlist.",
    'Items can be given by name or by numeric id. Defaults: game poe2, league current, unit auto.',
    'Writes (watch_item, unwatch_item) only take an exact item name or id; when an answer says "Did you mean", ask the user which one before trying again.',
].join(' ');

export interface McpServerOptions {
    db: Kysely<Database>;
    /** Who is calling. Tools act as this user and read nothing else about the caller. */
    principal: Principal;
    log?: (error: unknown) => void;
    now?: () => Date;
}

/** One server per request (the transport is stateless): it knows the caller and nothing else. */
export function createMcpServer(options: McpServerOptions): McpServer {
    const ctx: ToolContext = {
        db: options.db,
        principal: options.principal,
        log: options.log ?? (() => undefined),
        now: options.now ?? (() => new Date()),
    };
    const server = new McpServer({ name: 'poelens', version: '1.0.0' }, { instructions: INSTRUCTIONS });

    registerPriceTools(server, ctx);
    registerMoverTools(server, ctx);
    registerWatchlistTools(server, ctx);

    return server;
}
