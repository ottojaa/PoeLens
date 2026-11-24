import {
    DashboardChangedError,
    DashboardsFullError,
    GAMES,
    MAX_BLOCKS,
    MAX_DASHBOARDS,
    MAX_PANELS,
    NotFoundError,
    PanelsSchema,
    UnauthorizedError,
    ValidationError,
    normalize,
    place,
    toNewPanelSize,
    upgradePanels,
    type AppendBlockBody,
    type AppendBlockResponse,
    type CreateDashboardBody,
    type Dashboard,
    type DashboardOrderBody,
    type DashboardsResponse,
    type Game,
    type Panel,
    type SaveDashboardBody,
} from '@poelens/shared';
import { randomUUID } from 'node:crypto';
import { sql, type Kysely, type Selectable } from 'kysely';
import type { Database, DashboardsTable } from '../../db/schema.js';
import { buildStarterPanels, STARTER_NAME } from './starter.js';
import { assertPanelsKnown } from './validation.js';
import { toStarterId } from './starter-id.js';

type Trx = Kysely<Database>;

function toDashboard(row: Selectable<DashboardsTable>): Dashboard {
    return {
        id: row.id,
        game: row.game as Game,
        name: row.name,
        position: row.position,
        revision: row.revision,
        panels: PanelsSchema.parse(upgradePanels(row.panels)),
    };
}

/** `panels` is a JS array, which node-postgres would send as a Postgres array literal; as JSON text it is a jsonb value. */
const toJson = (panels: readonly Panel[]): string => JSON.stringify(panels);

async function buildStarter(db: Trx, userId: string, game: Game): Promise<Dashboard> {
    return { id: toStarterId(userId, game), game, name: STARTER_NAME, position: 0, revision: 0, panels: await buildStarterPanels(db, game) };
}

/** A user's dashboards of a game in tab order. A user with none gets the starter, built in memory: reading never writes. */
export async function listDashboards(db: Trx, userId: string, game: Game): Promise<DashboardsResponse> {
    const rows = await db.selectFrom('dashboards').selectAll().where('user_id', '=', userId).where('game', '=', game).orderBy('position').execute();

    if (!rows.length) return { dashboards: [await buildStarter(db, userId, game)], max: MAX_DASHBOARDS };

    return { dashboards: rows.map(toDashboard), max: MAX_DASHBOARDS };
}

/** Locks the user's row until the transaction ends, so two writes of one user (a cap check, a first save) take turns. */
async function lockUser(trx: Trx, userId: string): Promise<void> {
    const user = await sql<{ id: string }>`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`.execute(trx);

    if (!user.rows.length) throw new UnauthorizedError('Sign in to continue', 'TOKEN_INVALID');
}

/**
 * Stores the starter when the user has no dashboard in the game, at revision 0 (not the column's 1): the first save then
 * takes it to 1, and a second tab that still holds revision 0 is told the dashboard changed. Needs the user's lock.
 */
async function ensureStarter(trx: Trx, userId: string, game: Game): Promise<void> {
    const existing = await trx.selectFrom('dashboards').select('id').where('user_id', '=', userId).where('game', '=', game).limit(1).executeTakeFirst();

    if (existing) return;

    const starter = await buildStarter(trx, userId, game);

    await trx
        .insertInto('dashboards')
        .values({ id: starter.id, user_id: userId, game, name: starter.name, position: 0, panels: toJson(starter.panels), revision: 0 })
        .onConflict((conflict) => conflict.column('id').doNothing())
        .execute();
}

/** Adds a tab after the user's others. */
export async function createDashboard(db: Trx, userId: string, body: CreateDashboardBody): Promise<Dashboard> {
    return db.transaction().execute(async (trx) => {
        await lockUser(trx, userId);
        await ensureStarter(trx, userId, body.game);

        const { count } = await trx
            .selectFrom('dashboards')
            .select((eb) => eb.fn.countAll<string>().as('count'))
            .where('user_id', '=', userId)
            .where('game', '=', body.game)
            .executeTakeFirstOrThrow();

        if (Number(count) >= MAX_DASHBOARDS) throw new DashboardsFullError(MAX_DASHBOARDS);

        const row = await trx
            .insertInto('dashboards')
            .values({ user_id: userId, game: body.game, name: body.name, position: Number(count), panels: toJson([]) })
            .returningAll()
            .executeTakeFirstOrThrow();

        return toDashboard(row);
    });
}

/** The user's dashboard, found through the starter's fixed id when the user has not stored it yet. Null when it is not theirs. */
async function findDashboard(trx: Trx, userId: string, id: string): Promise<Selectable<DashboardsTable> | null> {
    const find = () => trx.selectFrom('dashboards').selectAll().where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
    const row = await find();

    if (row) return row;

    const game = GAMES.find((candidate) => toStarterId(userId, candidate) === id);

    if (!game) return null;

    await ensureStarter(trx, userId, game);

    return (await find()) ?? null;
}

/**
 * Saves a dashboard's name and panels (laid out by the grid engine, so what is stored never overlaps). The save must start
 * from the stored revision; any other is refused with the stored dashboard attached, for the client to reload or overwrite.
 */
export async function saveDashboard(db: Trx, userId: string, id: string, body: SaveDashboardBody): Promise<Dashboard> {
    return db.transaction().execute(async (trx) => {
        await lockUser(trx, userId);

        const row = await findDashboard(trx, userId, id);

        if (!row) throw new NotFoundError('Dashboard', id);

        await assertPanelsKnown(trx, row.game as Game, body.panels);

        if (row.revision !== body.revision) throw new DashboardChangedError(toDashboard(row));

        const saved = await trx
            .updateTable('dashboards')
            .set({ name: body.name, panels: toJson(normalize(body.panels)), revision: row.revision + 1, updated_at: sql`now()` })
            .where('id', '=', id)
            .where('user_id', '=', userId)
            .where('revision', '=', body.revision)
            .returningAll()
            .executeTakeFirstOrThrow();

        return toDashboard(saved);
    });
}

/** The panels with the block added: to the panel asked for, or to a new one below the rest. */
function withAppendedBlock(panels: readonly Panel[], body: AppendBlockBody, block: AppendBlockBody['block']): { panels: Panel[]; panelId: string } {
    if (body.panelId === undefined) {
        if (panels.length >= MAX_PANELS) throw new ValidationError('The dashboard is full: remove a panel first', { max: MAX_PANELS });

        const panel: Panel = {
            id: randomUUID(),
            title: body.title ?? '',
            ...place(panels, toNewPanelSize(block)),
            hideOnPhone: false,
            unit: null,
            blocks: [block],
        };

        return { panels: [...panels, panel], panelId: panel.id };
    }

    const target = panels.find((panel) => panel.id === body.panelId);

    if (!target) throw new NotFoundError('Panel', body.panelId);

    if (target.blocks.length >= MAX_BLOCKS) throw new ValidationError('The panel is full: remove a block first', { max: MAX_BLOCKS });

    return { panels: panels.map((panel) => (panel === target ? { ...panel, blocks: [...panel.blocks, block] } : panel)), panelId: target.id };
}

/**
 * Adds one block to a dashboard on the server's current copy, so a client that holds no layout (the economy page) can
 * still add. The block gets a fresh id, so it can never collide with one already stored. The dashboard's revision goes up
 * by one, which makes an editor open on the old revision learn of the change at its next save.
 */
export async function appendBlock(db: Trx, userId: string, id: string, body: AppendBlockBody): Promise<AppendBlockResponse> {
    return db.transaction().execute(async (trx) => {
        await lockUser(trx, userId);

        const row = await findDashboard(trx, userId, id);

        if (!row) throw new NotFoundError('Dashboard', id);

        const block = { ...body.block, id: randomUUID() };
        const { panels, panelId } = withAppendedBlock(toDashboard(row).panels, body, block);

        await assertPanelsKnown(trx, row.game as Game, panels);

        const saved = await trx
            .updateTable('dashboards')
            .set({ panels: toJson(normalize(panels)), revision: row.revision + 1, updated_at: sql`now()` })
            .where('id', '=', row.id)
            .where('user_id', '=', userId)
            .where('revision', '=', row.revision)
            .returning('revision')
            .executeTakeFirstOrThrow();

        return { panelId, blockId: block.id, revision: saved.revision };
    });
}

/** Deletes a tab and closes the gap it leaves. Deleting the last one brings back the starter on the next read. */
export async function deleteDashboard(db: Trx, userId: string, id: string): Promise<void> {
    await db.transaction().execute(async (trx) => {
        await lockUser(trx, userId);

        const row = await findDashboard(trx, userId, id);

        if (!row) throw new NotFoundError('Dashboard', id);

        await trx.deleteFrom('dashboards').where('id', '=', id).where('user_id', '=', userId).execute();

        const rest = await trx.selectFrom('dashboards').select('id').where('user_id', '=', userId).where('game', '=', row.game).orderBy('position').execute();

        for (const [position, { id: restId }] of rest.entries()) {
            await trx.updateTable('dashboards').set({ position }).where('id', '=', restId).execute();
        }
    });
}

/** Sets the tab order. The ids must be exactly the user's dashboards of the game. */
export async function reorderDashboards(db: Trx, userId: string, body: DashboardOrderBody): Promise<void> {
    await db.transaction().execute(async (trx) => {
        await lockUser(trx, userId);
        await ensureStarter(trx, userId, body.game);

        const rows = await trx.selectFrom('dashboards').select('id').where('user_id', '=', userId).where('game', '=', body.game).execute();
        const stored = new Set(rows.map((row) => row.id));
        const wanted = new Set(body.ids);

        if (wanted.size !== body.ids.length || wanted.size !== stored.size || !body.ids.every((id) => stored.has(id))) {
            throw new ValidationError('Order must list each dashboard once');
        }

        for (const [position, orderedId] of body.ids.entries()) {
            await trx.updateTable('dashboards').set({ position }).where('id', '=', orderedId).where('user_id', '=', userId).execute();
        }
    });
}
