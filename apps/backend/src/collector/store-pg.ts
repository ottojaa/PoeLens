import type { Game } from '@poelens/shared';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../db/schema.js';
import type { CollectorStore, LatestRaw, RawFilter, RawRecord, RunSummary } from './store.js';
import type { EntryFact, LeagueFact, LeagueRecord, ParsedFacts, RequestKey } from './types.js';

/** Postgres allows 65,535 bind parameters per statement; a price row binds 12, an item 6. */
const INSERT_CHUNK = 1_000;

function chunk<T>(rows: T[]): T[][] {
    const chunks: T[][] = [];

    for (let index = 0; index < rows.length; index += INSERT_CHUNK) chunks.push(rows.slice(index, index + INSERT_CHUNK));

    return chunks;
}

type Executor = Kysely<Database> | Transaction<Database>;

/** Stores the leagues a response lists and moves `current` to the ones it names. Leagues missing from the list keep their row. */
async function upsertLeagues(trx: Executor, game: Game, leagues: LeagueFact[], seenAt: Date): Promise<void> {
    if (!leagues.length) return;

    const currentNames = leagues.filter((league) => league.current).map((league) => league.name);

    // The unique index allows one current league per (game, hardcore): release the old one before the new one is set.
    await trx
        .updateTable('leagues')
        .set({ current: false })
        .where('game', '=', game)
        .$if(currentNames.length > 0, (query) => query.where('name', 'not in', currentNames))
        .where('current', '=', true)
        .execute();

    await trx
        .insertInto('leagues')
        .values(
            leagues.map((league) => ({ game, name: league.name, hardcore: league.hardcore, current: league.current, first_seen: seenAt, last_seen: seenAt })),
        )
        .onConflict((conflict) =>
            conflict.columns(['game', 'name']).doUpdateSet((eb) => ({
                hardcore: eb.ref('excluded.hardcore'),
                current: eb.ref('excluded.current'),
                last_seen: eb.ref('excluded.last_seen'),
            })),
        )
        .execute();
}

/** Resolves each entry's item id through `item_keys`, creating items and keys that are new and refreshing changed names. */
async function resolveItems(trx: Executor, source: string, game: Game, entries: EntryFact[]): Promise<Map<string, number>> {
    const keys = entries.map((entry) => entry.item.key);
    const known = await trx
        .selectFrom('item_keys')
        .innerJoin('items', 'items.id', 'item_keys.item_id')
        .select(['item_keys.external_key', 'items.id', 'items.name', 'items.base_type', 'items.category', 'items.icon'])
        .where('item_keys.source', '=', source)
        .where('item_keys.game', '=', game)
        .where('item_keys.external_key', 'in', keys)
        .execute();
    const ids = new Map(known.map((row) => [row.external_key, row.id]));
    const current = new Map(known.map((row) => [row.external_key, row]));

    for (const { item } of entries) {
        const row = current.get(item.key);

        if (!row) continue;

        const unchanged = row.name === item.name && row.base_type === item.baseType && row.category === item.category && row.icon === item.icon;

        if (unchanged) continue;

        await trx
            .updateTable('items')
            .set({ name: item.name, base_type: item.baseType, category: item.category, icon: item.icon })
            .where('id', '=', row.id)
            .execute();
    }

    const created = entries.filter((entry) => !ids.has(entry.item.key));

    for (const group of chunk(created)) {
        const inserted = await trx
            .insertInto('items')
            .values(group.map(({ item }) => ({ game, name: item.name, base_type: item.baseType, category: item.category, icon: item.icon })))
            .returning('id')
            .execute();

        if (inserted.length !== group.length) throw new Error('Item insert returned an unexpected row count: ' + inserted.length);

        const keyRows = group.map((entry, index) => ({ source, game, external_key: entry.item.key, item_id: inserted[index]!.id }));

        await trx.insertInto('item_keys').values(keyRows).execute();

        for (const row of keyRows) ids.set(row.external_key, row.item_id);
    }

    return ids;
}

async function upsertPrices(trx: Executor, raw: RawRecord, entries: EntryFact[], ids: Map<string, number>): Promise<void> {
    const rows = entries.map(({ item, price }) => ({
        time: raw.fetchedAt,
        game: raw.game,
        league: raw.league,
        item_id: ids.get(item.key)!,
        source: raw.source,
        divine: price.divine,
        exalted: price.exalted,
        chaos: price.chaos,
        listings: price.listings,
        volume: price.volume,
        low_confidence: price.lowConfidence,
        raw_id: raw.id,
    }));

    for (const group of chunk(rows)) {
        await trx
            .insertInto('prices')
            .values(group)
            .onConflict((conflict) =>
                conflict.columns(['game', 'league', 'item_id', 'source', 'time']).doUpdateSet((eb) => ({
                    divine: eb.ref('excluded.divine'),
                    exalted: eb.ref('excluded.exalted'),
                    chaos: eb.ref('excluded.chaos'),
                    listings: eb.ref('excluded.listings'),
                    volume: eb.ref('excluded.volume'),
                    low_confidence: eb.ref('excluded.low_confidence'),
                    raw_id: eb.ref('excluded.raw_id'),
                })),
            )
            .execute();
    }
}

function toRawRecord(row: {
    id: number;
    source: string;
    game: string;
    kind: string;
    league: string;
    category: string;
    fetched_at: Date;
    body: Buffer;
}): RawRecord {
    return {
        id: row.id,
        source: row.source,
        game: row.game as Game,
        kind: row.kind,
        league: row.league,
        category: row.category,
        fetchedAt: row.fetched_at,
        body: row.body,
    };
}

export function createPgCollectorStore(db: Kysely<Database>): CollectorStore {
    return {
        async startRun(source, game, startedAt) {
            const row = await db
                .insertInto('collector_runs')
                .values({ source, game, started_at: startedAt, status: 'running' })
                .returning('id')
                .executeTakeFirstOrThrow();

            return row.id;
        },

        async finishRun(id, finishedAt, summary: RunSummary) {
            await db
                .updateTable('collector_runs')
                .set({
                    finished_at: finishedAt,
                    status: summary.status,
                    error: summary.error,
                    requests: summary.requests,
                    unchanged: summary.unchanged,
                    stored: summary.stored,
                    price_rows: summary.priceRows,
                    parse_errors: summary.parseErrors,
                    fetch_errors: summary.fetchErrors,
                })
                .where('id', '=', id)
                .execute();
        },

        async findLastRunStart(source, game) {
            const row = await db
                .selectFrom('collector_runs')
                .select('started_at')
                .where('source', '=', source)
                .where('game', '=', game)
                .orderBy('started_at', 'desc')
                .limit(1)
                .executeTakeFirst();

            return row?.started_at ?? null;
        },

        async abandonStaleRuns(finishedAt) {
            const result = await db
                .updateTable('collector_runs')
                .set({ status: 'abandoned', finished_at: finishedAt, error: 'Process stopped during the cycle' })
                .where('status', '=', 'running')
                .executeTakeFirst();

            return Number(result.numUpdatedRows);
        },

        async loadLeagues(game): Promise<LeagueRecord[]> {
            return db.selectFrom('leagues').select(['name', 'hardcore', 'current']).where('game', '=', game).orderBy('name').execute();
        },

        async findLatestRaw(source, game, key: RequestKey): Promise<LatestRaw | null> {
            const row = await db
                .selectFrom('raw_responses')
                .select(['id', 'etag', 'sha256'])
                .where('source', '=', source)
                .where('game', '=', game)
                .where('kind', '=', key.kind)
                .where('league', '=', key.league)
                .where('category', '=', key.category)
                .orderBy('fetched_at', 'desc')
                .orderBy('id', 'desc')
                .limit(1)
                .executeTakeFirst();

            return row ?? null;
        },

        async insertRaw(raw) {
            const row = await db
                .insertInto('raw_responses')
                .values({
                    source: raw.source,
                    game: raw.game,
                    kind: raw.kind,
                    league: raw.league,
                    category: raw.category,
                    url: raw.url,
                    fetched_at: raw.fetchedAt,
                    status: raw.status,
                    etag: raw.etag,
                    sha256: raw.sha256,
                    body: raw.body,
                })
                .returning('id')
                .executeTakeFirstOrThrow();

            return row.id;
        },

        async updateEtag(id, etag) {
            await db.updateTable('raw_responses').set({ etag }).where('id', '=', id).execute();
        },

        async markParseError(id, message) {
            await db.updateTable('raw_responses').set({ parse_error: message }).where('id', '=', id).execute();
        },

        async applyFacts(raw, facts: ParsedFacts, parserVersion) {
            return db.transaction().execute(async (trx) => {
                await upsertLeagues(trx, raw.game, facts.leagues, raw.fetchedAt);

                if (facts.entries.length) {
                    const ids = await resolveItems(trx, raw.source, raw.game, facts.entries);

                    await upsertPrices(trx, raw, facts.entries, ids);
                }

                await trx.updateTable('raw_responses').set({ parser_version: parserVersion, parse_error: null }).where('id', '=', raw.id).execute();

                return facts.entries.length;
            });
        },

        async listRawIds(filter: RawFilter) {
            const rows = await db
                .selectFrom('raw_responses')
                .select('id')
                .where('source', '=', filter.source)
                .where('game', '=', filter.game)
                .$if(filter.kind !== undefined, (query) => query.where('kind', '=', filter.kind!))
                .$if(filter.category !== undefined, (query) => query.where('category', '=', filter.category!))
                .$if(filter.league !== undefined, (query) => query.where('league', '=', filter.league!))
                .$if(filter.from !== undefined, (query) => query.where('fetched_at', '>=', filter.from!))
                .$if(filter.to !== undefined, (query) => query.where('fetched_at', '<', filter.to!))
                .orderBy('fetched_at')
                .orderBy('id')
                .execute();

            return rows.map((row) => row.id);
        },

        async loadRaw(id) {
            const row = await db
                .selectFrom('raw_responses')
                .select(['id', 'source', 'game', 'kind', 'league', 'category', 'fetched_at', 'body'])
                .where('id', '=', id)
                .executeTakeFirstOrThrow();

            return toRawRecord(row);
        },
    };
}
