import type { Block, Game, Panel, PanelTemplate, TemplatesResponse } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { buildLinksPanel, buildRatesPanel, loadItemIdsByName, RATES_ITEM_NAMES } from './starter.js';

const CHASE_ITEM_NAMES = ['Headhunter', 'Original Sin'] as const;

function toPanel(id: string, title: string, size: { w: number; h: number }, blocks: Block[]): Panel {
    return { id, title, x: 0, y: 0, ...size, hideOnPhone: false, unit: null, blocks };
}

/** A heading, an item card for each chase unique the catalog has, and a price chart of the last one. */
function buildChasePanel(ids: ReadonlyMap<string, number>): Panel {
    const items = CHASE_ITEM_NAMES.map((name) => ({ name, id: ids.get(name) })).filter((entry) => entry.id !== undefined);
    const chart = items.at(-1);
    const blocks: Block[] = [
        { id: 'chase-heading', v: 1, type: 'heading', text: 'On my wishlist' },
        ...items.map(({ name, id }): Block => ({ id: 'chase-' + name.toLowerCase().replaceAll(' ', '-'), v: 1, type: 'item', item: id ?? 0, display: 'card' })),
    ];

    if (chart?.id !== undefined) blocks.push({ id: 'chase-chart', v: 1, type: 'chart', item: chart.id, quote: null, range: '7d' });

    return toPanel('chase', 'Chase uniques', { w: 4, h: 13 }, blocks);
}

function buildRisingPanel(): Panel {
    return toPanel('rising', 'Rising fast', { w: 4, h: 14 }, [
        {
            id: 'rising-screener',
            v: 1,
            type: 'screener',
            scope: { group: 'all' },
            windowHours: 3,
            direction: 'up',
            minChangePct: 20,
            minLiquidity: 50,
            minDivine: 1,
            limit: 5,
        },
    ]);
}

function buildBlankPanel(): Panel {
    return toPanel('blank', '', { w: 4, h: 8 }, []);
}

/** The panels Add panel offers. Item ids are looked up by name in the game's catalog; a name it lacks leaves that block out. */
export async function listTemplates(db: Kysely<Database>, game: Game): Promise<TemplatesResponse> {
    const ids = await loadItemIdsByName(db, game, [...RATES_ITEM_NAMES, ...CHASE_ITEM_NAMES]);
    const templates: PanelTemplate[] = [
        { id: 'currency-rates', name: 'Currency rates', description: '3 pairs, an item and a note', panel: buildRatesPanel(ids) },
        { id: 'chase-uniques', name: 'Chase uniques', description: 'A heading, 2 item cards and a price chart', panel: buildChasePanel(ids) },
        { id: 'rising-fast', name: 'Rising fast', description: 'A screener: +20% in 3 h, 50+ listings, 1+ div', panel: buildRisingPanel() },
        { id: 'useful-links', name: 'Useful links', description: 'A note with your links', panel: buildLinksPanel() },
        { id: 'blank', name: 'Blank', description: 'An empty panel. Add blocks yourself.', panel: buildBlankPanel() },
    ];

    return { templates };
}
