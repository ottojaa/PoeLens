import type { BlockData, DashboardDataBody, DashboardDataResponse, DataBlock, DataBlockType } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { resolveContext } from '../prices/context.js';
import { groupBy } from './group-by.js';
import { logDataFailure, type DataLog } from './resolvers/data-log.js';
import { RESOLVERS } from './resolvers/index.js';
import type { ResolverContext, ResolverEntry } from './resolvers/types.js';

type AnyResolver = (db: Kysely<Database>, context: ResolverContext, entries: readonly ResolverEntry[]) => Promise<Map<string, BlockData | null>>;

/** Runs one type's resolver. The cast joins the per-type resolvers back to the block union: entries are grouped by type, so each resolver gets only its own. */
async function resolveType(
    db: Kysely<Database>,
    context: ResolverContext,
    type: DataBlockType,
    entries: ResolverEntry[],
): Promise<Map<string, BlockData | null>> {
    try {
        return await (RESOLVERS[type] as AnyResolver)(db, context, entries);
    } catch (error) {
        logDataFailure(context.log, error, type);

        return new Map(entries.map((entry) => [entry.block.id, null]));
    }
}

/**
 * The data behind a dashboard's blocks, by block id. Each type is answered by its own resolver, in parallel; a type that
 * fails answers null for its blocks, is logged, and leaves the others alone.
 */
export async function getDashboardData(db: Kysely<Database>, body: DashboardDataBody, log?: DataLog, now = new Date()): Promise<DashboardDataResponse> {
    const context = await resolveContext(db, { game: body.game, league: body.league, ...(body.unit && { unit: body.unit }) });
    const entries: ResolverEntry[] = body.panels.flatMap((panel) => panel.blocks.map((block: DataBlock) => ({ block, unit: panel.unit ?? context.unit })));
    const byType = groupBy(entries, (entry) => entry.block.type);
    const resolverContext: ResolverContext = { game: context.game, league: context.league.name, now, log };
    const answered = await Promise.all([...byType].map(([type, group]) => resolveType(db, resolverContext, type, group)));

    return { game: context.game, league: context.league, unit: context.unit, blocks: Object.fromEntries(answered.flatMap((answers) => [...answers])) };
}
