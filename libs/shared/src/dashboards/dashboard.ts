import { z } from 'zod';
import { ItemRefSchema, LeagueRefSchema, TableRowSchema } from '../api/schemas/prices.js';
import { GameSchema } from '../domain/game.js';
import { UnitChoiceSchema } from '../domain/units.js';
import { BlockIdSchema, BlocksSchema, DataBlockSchema } from './blocks.js';
import { GRID_COLUMNS, MAX_BLOCKS, MAX_DASHBOARDS, MAX_PANEL_ROWS, MAX_PANEL_Y, MAX_PANELS } from './limits.js';

export const MAX_DASHBOARD_NAME = 40;
export const MAX_PANEL_TITLE = 60;

export const PanelSchema = z.object({
    id: z.string().min(1).max(64),
    title: z.string().trim().max(MAX_PANEL_TITLE),
    x: z
        .number()
        .int()
        .min(0)
        .max(GRID_COLUMNS - 1),
    y: z.number().int().min(0).max(MAX_PANEL_Y),
    w: z.number().int().min(1).max(GRID_COLUMNS),
    h: z.number().int().min(1).max(MAX_PANEL_ROWS),
    hideOnPhone: z.boolean(),
    /** Null means "same as the header's unit". */
    unit: UnitChoiceSchema.nullable(),
    blocks: BlocksSchema,
});

export type Panel = z.infer<typeof PanelSchema>;

/** Ids that must not repeat: a block's id keys its data, a panel's id keys its place. */
function hasUniqueIds(panels: readonly Panel[]): boolean {
    const panelIds = new Set(panels.map((panel) => panel.id));
    const blockIds = new Set(panels.flatMap((panel) => panel.blocks.map((block) => block.id)));
    const blockCount = panels.reduce((total, panel) => total + panel.blocks.length, 0);

    return panelIds.size === panels.length && blockIds.size === blockCount;
}

/** Panels as stored: within the caps, with unique ids, and no panel running past the right edge. */
export const PanelsSchema = z
    .array(PanelSchema)
    .max(MAX_PANELS)
    .refine(hasUniqueIds, 'Panel and block ids must be unique')
    .refine((panels) => panels.every((panel) => panel.x + panel.w <= GRID_COLUMNS), 'A panel runs past the grid');

export const DashboardNameSchema = z.string().trim().min(1).max(MAX_DASHBOARD_NAME);

export const DashboardSchema = z.object({
    id: z.string().uuid(),
    game: GameSchema,
    name: DashboardNameSchema,
    /** Tab order, from 0. */
    position: z.number().int().min(0),
    /** Counts saves. 0 is a starter that hasn't been stored yet. */
    revision: z.number().int().min(0),
    panels: PanelsSchema,
});

export type Dashboard = z.infer<typeof DashboardSchema>;

// Routes

export const DashboardParamsSchema = z.object({ id: z.string().uuid() });

export const DashboardsQuerySchema = z.object({ game: GameSchema });

export const DashboardsResponseSchema = z.object({
    dashboards: z.array(DashboardSchema),
    /** How many dashboards the user can keep per game. */
    max: z.number().int(),
});

export const CreateDashboardBodySchema = z.object({ game: GameSchema, name: DashboardNameSchema });

export const SaveDashboardBodySchema = z.object({
    /** The revision this edit started from. A save on any other revision is refused. */
    revision: z.number().int().min(0),
    name: DashboardNameSchema,
    panels: PanelsSchema,
});

export const DashboardOrderBodySchema = z.object({
    game: GameSchema,
    ids: z.array(z.string().uuid()).min(1).max(MAX_DASHBOARDS),
});

export type DashboardParams = z.infer<typeof DashboardParamsSchema>;
export type DashboardsQuery = z.infer<typeof DashboardsQuerySchema>;
export type DashboardsResponse = z.infer<typeof DashboardsResponseSchema>;
export type CreateDashboardBody = z.infer<typeof CreateDashboardBodySchema>;
export type SaveDashboardBody = z.infer<typeof SaveDashboardBodySchema>;
export type DashboardOrderBody = z.infer<typeof DashboardOrderBodySchema>;

// Data

export const DataPanelSchema = z.object({
    /** Null means "same as the request's unit". */
    unit: UnitChoiceSchema.nullable(),
    blocks: z.array(DataBlockSchema).max(MAX_BLOCKS),
});

export const DashboardDataBodySchema = z
    .object({
        game: GameSchema,
        league: z.string().min(1).default('current'),
        /** The header's unit; defaults to the game's. */
        unit: UnitChoiceSchema.optional(),
        panels: z.array(DataPanelSchema).max(MAX_PANELS),
    })
    .refine(
        ({ panels }) => {
            const ids = panels.flatMap((panel) => panel.blocks.map((block) => block.id));

            return new Set(ids).size === ids.length;
        },
        { message: 'Block ids must be unique' },
    );

export const ItemBlockDataSchema = z.object({
    type: z.literal('item'),
    item: ItemRefSchema,
    /** Null when the item has no confident price in the league. */
    row: TableRowSchema.nullable(),
});

export const PairBlockDataSchema = z.object({
    type: z.literal('pair'),
    a: ItemRefSchema,
    b: ItemRefSchema,
    /** How many `b` one `a` buys; null when either side has no price. */
    price: z.number().nullable(),
    /** The rate's change over 24 hours, in percent (5 is +5%), measured in divine. */
    h24: z.number().nullable(),
    /** The rate's daily closes over the last week, oldest first. */
    sparkline: z.array(z.number()),
    lowConfidence: z.boolean(),
    asOf: z.string().datetime().nullable(),
});

export const BlockDataSchema = z.discriminatedUnion('type', [ItemBlockDataSchema, PairBlockDataSchema]);

export const DashboardDataResponseSchema = z.object({
    game: GameSchema,
    league: LeagueRefSchema,
    /** The header unit the request resolved to. */
    unit: UnitChoiceSchema,
    /** By block id. A block that failed, or whose items are gone, is null; notes and headings have no entry. */
    blocks: z.record(BlockIdSchema, BlockDataSchema.nullable()),
});

export type DataPanel = z.infer<typeof DataPanelSchema>;
export type DashboardDataBody = z.infer<typeof DashboardDataBodySchema>;
export type BlockData = z.infer<typeof BlockDataSchema>;
export type ItemBlockData = z.infer<typeof ItemBlockDataSchema>;
export type PairBlockData = z.infer<typeof PairBlockDataSchema>;
export type DashboardDataResponse = z.infer<typeof DashboardDataResponseSchema>;
