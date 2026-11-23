import type { Unit } from '@poelens/shared';
import { z } from 'zod';
import { ParseError, type EntryFact, type ItemFact, type LeagueFact, type ParsedFacts, type PriceFact } from '../../types.js';
import { ExchangeBodySchema, LeaguesBodySchema, StashBodySchema } from './schemas.js';

/** A unique with fewer listings than this has a price that one seller sets (a lone listing shows 39,235,000 divine). */
export const MIN_LISTINGS = 5;

/**
 * An exchange line whose traded value is under this many units of the item itself is too thin to trust. Kept at one unit
 * on purpose: the rarest and dearest currencies (Mirror of Kalandra, Hinekora's Lock) trade only a few units an hour, so a
 * higher cut would hide them from the default table. A line just above it can still swing hard between polls. Changing the
 * number means bumping `PARSER_VERSION` and reparsing.
 */
export const MIN_TRADED_UNITS = 1;

/** Exchange images are paths on GGG's image host, not on poe.ninja. */
const IMAGE_HOST = 'https://web.poecdn.com';

const EMPTY: ParsedFacts = { leagues: [], entries: [] };

function parseJson<T>(schema: z.ZodType<T>, body: string, what: string): T {
    let json: unknown;

    try {
        json = JSON.parse(body);
    } catch {
        throw new ParseError('Response is not JSON: ' + what);
    }

    const result = schema.safeParse(json);

    if (result.success) return result.data;

    const [issue] = result.error.issues;

    throw new ParseError(`Unexpected ${what} response: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`.trim());
}

function isHardcoreLeague(name: string): boolean {
    return name === 'Hardcore' || name.startsWith('HC ');
}

/** poe.ninja lists the current challenge league first, and its hardcore version is named "HC <league>". */
export function parseLeagues(body: string): ParsedFacts {
    const list = parseJson(LeaguesBodySchema, body, 'leagues');
    const [first] = list;
    const names = list.map((league) => league.name);

    if (new Set(names).size !== names.length) throw new ParseError('Duplicate league name in leagues response');

    const leagues: LeagueFact[] = names.map((name) => ({
        name,
        hardcore: isHardcoreLeague(name),
        current: name === first?.name || name === `HC ${first?.name}`,
    }));

    return { ...EMPTY, leagues };
}

type Core = z.infer<typeof ExchangeBodySchema>['core'];

/** Converts a value in the response's primary unit into each unit, with that response's own rates. */
function toUnits(primaryValue: number, core: Core): Pick<PriceFact, Unit> {
    const factor = (unit: Unit): number => {
        if (unit === core.primary) return 1;

        const rate = core.rates[unit];

        if (rate === undefined || !Number.isFinite(rate) || rate <= 0) throw new ParseError('Missing conversion rate: ' + unit);

        return rate;
    };

    return {
        divine: primaryValue * factor('divine'),
        exalted: primaryValue * factor('exalted'),
        chaos: primaryValue * factor('chaos'),
    };
}

function assertUniqueKeys(entries: EntryFact[]): void {
    const seen = new Set<string>();

    for (const { item } of entries) {
        if (seen.has(item.key)) throw new ParseError('Duplicate item key: ' + item.key);

        seen.add(item.key);
    }
}

/** An exchange overview (currencies, fragments, runes and so on): items are keyed by their `id`, liquidity is traded value. */
export function parseExchange(category: string, body: string): ParsedFacts {
    const { core, lines, items } = parseJson(ExchangeBodySchema, body, 'exchange');
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const divinePerPrimary = toUnits(1, core).divine;
    const entries = lines.map((line): EntryFact => {
        const meta = itemsById.get(line.id);

        if (!meta) throw new ParseError('Exchange line without an item: ' + line.id);

        const item: ItemFact = {
            key: 'exchange:' + line.id,
            name: meta.name,
            baseType: null,
            category,
            icon: meta.image ? IMAGE_HOST + meta.image : null,
        };
        const price: PriceFact = {
            ...toUnits(line.primaryValue, core),
            listings: null,
            volume: line.volumePrimaryValue * divinePerPrimary,
            lowConfidence: line.volumePrimaryValue < MIN_TRADED_UNITS * line.primaryValue,
        };

        return { item, price };
    });

    assertUniqueKeys(entries);

    return { ...EMPTY, entries };
}

/** A stash item overview (uniques, tablets): items are keyed by `detailsId`, liquidity is the listing count. */
export function parseStash(category: string, body: string): ParsedFacts {
    const { core, lines } = parseJson(StashBodySchema, body, 'stash');
    const entries = lines.map(
        (line): EntryFact => ({
            item: { key: 'stash:' + line.detailsId, name: line.name, baseType: line.baseType ?? null, category, icon: line.icon ?? null },
            price: {
                ...toUnits(line.primaryValue, core),
                listings: line.listingCount,
                volume: null,
                lowConfidence: line.listingCount < MIN_LISTINGS,
            },
        }),
    );

    assertUniqueKeys(entries);

    return { ...EMPTY, entries };
}
