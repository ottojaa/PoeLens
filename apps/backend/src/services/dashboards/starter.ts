import type { Block, Game, Panel } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';

export const STARTER_NAME = 'Trading';

const USEFUL_LINKS = [
    '### Links',
    '- [poe2db](https://poe2db.tw): bases and mods',
    '- [maxroll](https://maxroll.gg/poe2): build planner',
    '- [Trade site](https://www.pathofexile.com/trade2): search and whisper',
    '- [poe.ninja](https://poe.ninja): builds',
].join('\n');

/** The ids of items by exact name in a game; a name the catalog doesn't have is absent. */
async function loadItemIdsByName(db: Kysely<Database>, game: Game, names: readonly string[]): Promise<Map<string, number>> {
    const rows = await db
        .selectFrom('items')
        .select(['id', 'name'])
        .where('game', '=', game)
        .where('name', 'in', [...names])
        .orderBy('id')
        .execute();
    const ids = new Map<string, number>();

    for (const row of rows) if (!ids.has(row.name)) ids.set(row.name, row.id);

    return ids;
}

function toRatesBlocks(ids: ReadonlyMap<string, number>): Block[] {
    const id = (name: string) => ids.get(name);
    const divine = id('Divine Orb');
    const exalted = id('Exalted Orb');
    const chaos = id('Chaos Orb');
    const annulment = id('Orb of Annulment');
    const perfectChaos = id('Perfect Chaos Orb');
    const blocks: (Block | null)[] = [
        divine && exalted ? { id: 'rate-div-ex', v: 1, type: 'pair', a: divine, b: exalted } : null,
        divine && chaos ? { id: 'rate-div-chaos', v: 1, type: 'pair', a: divine, b: chaos } : null,
        annulment && exalted ? { id: 'rate-ann-ex', v: 1, type: 'pair', a: annulment, b: exalted } : null,
        perfectChaos ? { id: 'item-perfect-chaos', v: 1, type: 'item', item: perfectChaos, display: 'compact' } : null,
        { id: 'rates-note', v: 1, type: 'note', markdown: 'Sell Perfect Chaos Orbs above your target price.' },
    ];

    return blocks.filter((block) => block !== null);
}

/** What a user sees until they first save: Currency rates and Useful links, for games that have a catalog to build them from. */
export async function buildStarterPanels(db: Kysely<Database>, game: Game): Promise<Panel[]> {
    if (game !== 'poe2') return [];

    const ids = await loadItemIdsByName(db, game, ['Divine Orb', 'Exalted Orb', 'Chaos Orb', 'Orb of Annulment', 'Perfect Chaos Orb']);

    return [
        { id: 'rates', title: 'Currency rates', x: 0, y: 0, w: 4, h: 10, hideOnPhone: false, unit: 'exalted', blocks: toRatesBlocks(ids) },
        {
            id: 'links',
            title: 'Useful links',
            x: 4,
            y: 0,
            w: 3,
            h: 9,
            hideOnPhone: false,
            unit: null,
            blocks: [{ id: 'links-note', v: 1, type: 'note', markdown: USEFUL_LINKS }],
        },
    ];
}
