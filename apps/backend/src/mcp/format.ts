import { GAME_LABELS, POE_NINJA_ATTRIBUTION, type Game, type ItemRef, type LeagueRef, type PriceRow, type Unit, type UnitChoice } from '@poelens/shared';
import type { Resolution } from './resolve-item.js';

const UNIT_LABELS: Record<Unit, string> = { divine: 'div', exalted: 'ex', chaos: 'c' };

/** A number at the precision a price needs: whole above 100, fewer digits the larger it is, three significant below 1. */
export function formatNumber(value: number): string {
    const abs = Math.abs(value);

    if (abs >= 100) return Math.round(value).toLocaleString('en-US');

    if (abs >= 10) return value.toFixed(1);

    if (abs >= 1) return value.toFixed(2);

    if (abs === 0) return '0';

    return Number(value.toPrecision(3)).toString();
}

export function formatPrice(value: number, unit: Unit): string {
    return formatNumber(value) + ' ' + UNIT_LABELS[unit];
}

export function formatPercent(change: number | null): string {
    if (change === null) return 'n/a';

    return (change > 0 ? '+' : '') + change.toFixed(1) + '%';
}

/** "5 min ago", "3 h ago", "2 d ago". */
export function formatAge(from: Date | string, now: Date): string {
    const minutes = Math.max(0, Math.round((now.getTime() - new Date(from).getTime()) / 60_000));

    if (minutes < 1) return 'just now';

    if (minutes < 60) return minutes + ' min ago';

    if (minutes < 48 * 60) return Math.round(minutes / 60) + ' h ago';

    return Math.round(minutes / 1440) + ' d ago';
}

function unitText(unit: UnitChoice): string {
    return unit === 'auto' ? 'auto (each price in the unit it reads best in)' : unit;
}

/** The first line of an answer: what was resolved, and how old the data is. */
export function header(input: { game: Game; league: LeagueRef; unit: UnitChoice; asOf: string | null; now: Date; extra?: string }): string {
    const age = input.asOf ? 'prices ' + formatAge(input.asOf, input.now) : 'no prices yet';
    const parts = [GAME_LABELS[input.game], input.league.name + (input.league.hardcore ? ' (hardcore)' : ''), 'unit: ' + unitText(input.unit), age];

    return (input.extra ? [...parts, input.extra] : parts).join(' · ');
}

/** The newest `asOf` of some rows, or null without rows. */
export function newestAsOf(rows: readonly Pick<PriceRow, 'asOf'>[]): string | null {
    return rows.reduce<string | null>((newest, row) => (newest === null || row.asOf > newest ? row.asOf : newest), null);
}

/** "Name (Category, id 12)": enough for a model to pick one and name it again by id. */
export function describeItem(item: ItemRef): string {
    const base = item.baseType && item.baseType !== item.name ? `, ${item.baseType}` : '';

    return `${item.name} (${item.category}${base}, id ${item.id})`;
}

function describeLiquidity(row: PriceRow): string {
    if (!row.liquidity) return '';

    return row.liquidity.kind === 'listings' ? `${formatNumber(row.liquidity.value)} listings` : `${formatNumber(row.liquidity.value)} div traded`;
}

/** One price row as one line: its price in its own unit and in divine, the changes, liquidity and flags. */
export function formatPriceLine(row: PriceRow, now: Date): string {
    const price = formatPrice(row.price, row.unit);
    const inDivine = row.unit === 'divine' ? '' : ` = ${formatPrice(row.prices.divine, 'divine')}`;
    const details = [`24h ${formatPercent(row.change.h24)}`, `7d ${formatPercent(row.change.d7)}`, describeLiquidity(row), formatAge(row.asOf, now)];

    if (row.lowConfidence) details.push('LOW CONFIDENCE: very few listings, treat the price as a rough guess');

    return `${row.item.name} (id ${row.item.id}): ${price}${inDivine} | ${details.filter(Boolean).join(', ')}`;
}

/** The lines that say what an item text could not resolve to, in a read or a write. */
export function formatUnresolved(text: string, resolution: Extract<Resolution, { kind: 'unresolved' }>, mode: 'read' | 'write'): string {
    const { candidates, why } = resolution;

    if (!candidates.length) return `No item matches "${text}".` + (mode === 'write' ? ' Nothing was changed.' : '');

    const lead = why === 'ambiguous' ? `More than one item is named "${text}".` : `"${text}" is not an exact item name.`;
    const options = candidates.map((item) => '  - ' + describeItem(item)).join('\n');
    const tail = mode === 'write' ? 'Nothing was changed: ask again with the exact name or the id.' : 'Ask again with the exact name or the id.';

    return `${lead} Did you mean:\n${options}\n${tail}`;
}

/** Closes an answer with the data's source: once per answer. */
export function withCredit(lines: string[]): string {
    return [...lines, '', POE_NINJA_ATTRIBUTION].join('\n');
}
