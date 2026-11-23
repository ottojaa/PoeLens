import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ParseError } from '../../types.js';
import { MIN_LISTINGS, parseExchange, parseLeagues, parseStash } from './parse.js';
import { createPoeNinjaPoe2Adapter } from './poe2.js';

function fixture(name: string): string {
    return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

function entryFor(facts: ReturnType<typeof parseExchange>, key: string) {
    const entry = facts.entries.find((candidate) => candidate.item.key === key);

    if (!entry) throw new Error('No entry: ' + key);

    return entry;
}

describe('parseLeagues', () => {
    it('marks the first league and its hardcore version as current', () => {
        const { leagues } = parseLeagues(fixture('leagues.json'));
        const current = leagues.filter((league) => league.current).map((league) => league.name);

        expect(current).toEqual(['Forbidden Rites', 'HC Forbidden Rites']);
        expect(leagues.find((league) => league.name === 'HC Forbidden Rites')?.hardcore).toBe(true);
        expect(leagues.find((league) => league.name === 'Hardcore')?.hardcore).toBe(true);
        expect(leagues.find((league) => league.name === 'Standard')).toEqual({ name: 'Standard', hardcore: false, current: false });
    });

    it('makes a league that appears first current with no code change', () => {
        const { leagues } = parseLeagues(fixture('leagues-new-first-league.json'));
        const current = leagues.filter((league) => league.current).map((league) => league.name);

        expect(current).toEqual(['Rise of the Abyssal', 'HC Rise of the Abyssal']);
    });

    it('rejects a body that is not the expected shape', () => {
        expect(() => parseLeagues('not json')).toThrow(ParseError);
        expect(() => parseLeagues('{}')).toThrow(ParseError);
        expect(() => parseLeagues('[]')).toThrow(ParseError);
        expect(() => parseLeagues('[{"id":"a","name":"A"},{"id":"a","name":"A"}]')).toThrow('Duplicate league name');
    });
});

describe('parseExchange', () => {
    const facts = parseExchange('Currency', fixture('exchange-currency.json'));

    it('keys items by their id and fills the catalog fields', () => {
        expect(facts.entries).toHaveLength(12);
        expect(entryFor(facts, 'exchange:divine').item).toMatchObject({ name: 'Divine Orb', baseType: null, category: 'Currency' });
        expect(entryFor(facts, 'exchange:divine').item.icon).toMatch(/^https:\/\/web\.poecdn\.com\/gen\/image\//);
    });

    it('converts into every unit with this response own rates', () => {
        const mirror = entryFor(facts, 'exchange:mirror').price;

        expect(mirror.divine).toBeCloseTo(5715, 6);
        expect(mirror.exalted).toBeCloseTo(5715 * 445.9, 3);
        expect(mirror.chaos).toBeCloseTo(5715 * 13.44, 3);
        expect(entryFor(facts, 'exchange:divine').price).toMatchObject({ divine: 1, exalted: 445.9, chaos: 13.44 });
    });

    it('reports traded volume in divine, with no listing count', () => {
        const mirror = entryFor(facts, 'exchange:mirror').price;

        expect(mirror.volume).toBeCloseTo(39054, 6);
        expect(mirror.listings).toBeNull();
    });

    it('flags a line that trades under one unit of itself as low confidence, and only that', () => {
        const flagged = facts.entries.filter((entry) => entry.price.lowConfidence).map((entry) => entry.item.key);

        expect(flagged).toEqual(['exchange:yaomacs-orb-of-sacrifice']);
    });

    it('converts correctly when the primary unit is not divine', () => {
        const body = JSON.stringify({
            core: { primary: 'exalted', rates: { divine: 0.0022, chaos: 0.03 } },
            lines: [{ id: 'a', primaryValue: 100, volumePrimaryValue: 5000 }],
            items: [{ id: 'a', name: 'A' }],
        });
        const { price } = entryFor(parseExchange('Currency', body), 'exchange:a');

        expect(price.exalted).toBe(100);
        expect(price.divine).toBeCloseTo(0.22, 9);
        expect(price.chaos).toBeCloseTo(3, 9);
        // Volume is stored in divine whatever the response's primary unit is.
        expect(price.volume).toBeCloseTo(5000 * 0.0022, 9);
    });

    it('rejects a response that cannot be converted, has an unknown line, or repeats a key', () => {
        const base = { core: { primary: 'divine', rates: { exalted: 400, chaos: 13 } }, items: [{ id: 'a', name: 'A' }] };
        const line = { id: 'a', primaryValue: 1, volumePrimaryValue: 1 };

        expect(() => parseExchange('Currency', JSON.stringify({ ...base, core: { primary: 'divine', rates: { exalted: 400 } }, lines: [line] }))).toThrow(
            'Missing conversion rate: chaos',
        );
        expect(() => parseExchange('Currency', JSON.stringify({ ...base, lines: [{ ...line, id: 'zzz' }] }))).toThrow('Exchange line without an item: zzz');
        expect(() => parseExchange('Currency', JSON.stringify({ ...base, lines: [line, line] }))).toThrow('Duplicate item key: exchange:a');
        expect(() => parseExchange('Currency', JSON.stringify({ lines: [] }))).toThrow(ParseError);
    });
});

describe('parseStash', () => {
    const facts = parseStash('UniqueWeapons', fixture('stash-unique-weapons.json'));

    it('keys items by detailsId and keeps the base type and listing count', () => {
        const winters = facts.entries.find((entry) => entry.item.name === "Winter's Bite")!;

        expect(winters.item).toMatchObject({ name: "Winter's Bite", baseType: 'Glass Shank', category: 'UniqueWeapons' });
        expect(winters.price.listings).toBe(1);
        expect(winters.price.volume).toBeNull();
    });

    it('uses the stash response own rates, not the exchange ones', () => {
        const ordained = facts.entries.find((entry) => entry.item.name === 'The Ordained')!.price;

        expect(ordained.exalted / ordained.divine).toBeCloseTo(495.3, 6);
        expect(ordained.chaos / ordained.divine).toBeCloseTo(11.79, 6);
    });

    it('flags a unique with fewer listings than the minimum as low confidence', () => {
        for (const { item, price } of facts.entries) {
            expect(price.lowConfidence, item.name).toBe((price.listings ?? 0) < MIN_LISTINGS);
        }

        expect(facts.entries.some((entry) => entry.price.lowConfidence)).toBe(true);
        expect(facts.entries.some((entry) => !entry.price.lowConfidence)).toBe(true);
    });

    it('rejects a repeated detailsId within one response', () => {
        const line = { detailsId: 'x', name: 'X', primaryValue: 1, listingCount: 10 };
        const body = JSON.stringify({ core: { primary: 'divine', rates: { exalted: 400, chaos: 13 } }, lines: [line, line] });

        expect(() => parseStash('UniqueWeapons', body)).toThrow('Duplicate item key: stash:x');
    });
});

describe('the poe.ninja PoE 2 adapter', () => {
    const adapter = createPoeNinjaPoe2Adapter();
    const known = parseLeagues(fixture('leagues.json')).leagues;

    it('dispatches parsing by request kind', () => {
        expect(adapter.parse({ kind: 'leagues', league: '', category: '' }, fixture('leagues.json')).leagues).toHaveLength(known.length);
        expect(adapter.parse({ kind: 'exchange', league: 'L', category: 'Currency' }, fixture('exchange-currency.json')).entries).toHaveLength(12);
        expect(() => adapter.parse({ kind: 'builds', league: '', category: '' }, '{}')).toThrow('Unknown request kind: builds');
    });

    it('plans 23 requests for each of the current league and its hardcore version, and only economy endpoints', () => {
        const plan = adapter.plan(known);
        const leagues = new Set(plan.map((spec) => spec.league));

        expect(plan).toHaveLength(46);
        expect([...leagues]).toEqual(['Forbidden Rites', 'HC Forbidden Rites']);
        expect(plan.filter((spec) => spec.league === 'Forbidden Rites').filter((spec) => spec.kind === 'exchange')).toHaveLength(14);
        expect(plan.filter((spec) => spec.league === 'Forbidden Rites').filter((spec) => spec.kind === 'stash')).toHaveLength(9);

        for (const spec of plan) expect(spec.url).toMatch(/^https:\/\/poe\.ninja\/poe2\/api\/economy\/(exchange|stash)\/current\/(item\/)?overview\?/);
    });

    it('plans only the leagues named by the env list, when there is one', () => {
        const custom = createPoeNinjaPoe2Adapter({ leagues: ['Standard'] });

        expect(new Set(custom.plan(known).map((spec) => spec.league))).toEqual(new Set(['Standard']));
    });

    it('follows a new first league without a code change', () => {
        const next = parseLeagues(fixture('leagues-new-first-league.json')).leagues;

        expect(new Set(adapter.plan(next).map((spec) => spec.league))).toEqual(new Set(['Rise of the Abyssal', 'HC Rise of the Abyssal']));
    });
});
