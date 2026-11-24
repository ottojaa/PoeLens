import {
    CATEGORIES,
    COLUMN_LABELS,
    MAX_LIST_ROWS,
    MAX_SCREENER_HOURS,
    MAX_TABLE_ROWS,
    OPTIONAL_COLUMNS,
    SORT_KEYS,
    UNITS,
    type ChartBlock,
    type MoversBlock,
    type ScreenerBlock,
    type TableBlock,
    type Unit,
} from '@poelens/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import type { BlockPatch } from '@/lib/dashboard/editor';
import { useUnitItemId } from '@/lib/dashboard/unit-item';
import { UNIT_LABEL } from '@/lib/economy/units';
import { GAME, useEconomyContext } from '@/lib/economy/use-economy-context';
import { SORT_LABEL } from '../blocks/block-format';
import { ChoiceMenu, Field, NumberField, ScopeField } from './SettingsFields';

type Patch = (patch: BlockPatch) => void;

const CATEGORY_OPTIONS = CATEGORIES[GAME].map((category) => ({ value: category.id, label: category.label }));
const SORT_OPTIONS = SORT_KEYS.map((key) => ({ value: key, label: SORT_LABEL[key].replace(/^./, (letter) => letter.toUpperCase()) }));

function RowsField({ id, value, max, onPatch }: { id: string; value: number; max: number; onPatch: (limit: number) => void }) {
    return (
        <Field label="Rows" htmlFor={id} hint={'Up to ' + max + '.'}>
            <NumberField id={id} value={value} min={1} max={max} onChange={(next) => next !== null && onPatch(next)} />
        </Field>
    );
}

export function TableSettings({ block, onPatch }: { block: TableBlock; onPatch: Patch }) {
    const id = (name: string) => name + '-' + block.id;
    const toggleColumn = (column: (typeof OPTIONAL_COLUMNS)[number], on: boolean) =>
        onPatch({ columns: OPTIONAL_COLUMNS.filter((candidate) => (candidate === column ? on : block.columns.includes(candidate))) });

    return (
        <>
            <Field label="Category">
                <ChoiceMenu label="Category" value={block.category} options={CATEGORY_OPTIONS} onChange={(category) => onPatch({ category })} />
            </Field>
            <Field label="Sort by">
                <ChoiceMenu label="Sort by" value={block.sort} options={SORT_OPTIONS} onChange={(sort) => onPatch({ sort })} />
                <Segmented
                    label="Direction"
                    value={block.dir}
                    options={[
                        { value: 'desc', label: 'Highest first' },
                        { value: 'asc', label: 'Lowest first' },
                    ]}
                    onChange={(dir) => onPatch({ dir })}
                />
            </Field>
            <Field label="Name contains" htmlFor={id('q')}>
                <Input id={id('q')} value={block.q} maxLength={100} onChange={(event) => onPatch({ q: event.target.value })} />
            </Field>
            <Field label="At least this many listings" htmlFor={id('liquidity')} hint="Items traded in divine count their traded value instead.">
                <NumberField
                    id={id('liquidity')}
                    value={block.minLiquidity}
                    min={0}
                    max={1_000_000}
                    onChange={(next) => onPatch({ minLiquidity: next ?? 0 })}
                />
            </Field>
            <div className="flex items-center gap-3">
                <label htmlFor={id('low')} className="flex-1 cursor-pointer text-sm font-semibold">
                    Hide low-confidence prices
                </label>
                <Switch id={id('low')} checked={block.hideLowConfidence} onCheckedChange={(hideLowConfidence) => onPatch({ hideLowConfidence })} />
            </div>
            <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-semibold">Columns</legend>
                {OPTIONAL_COLUMNS.map((column) => (
                    <label key={column} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={block.columns.includes(column)} onCheckedChange={(on) => toggleColumn(column, on === true)} />
                        {COLUMN_LABELS[column]}
                    </label>
                ))}
            </fieldset>
            <RowsField id={id('rows')} value={block.limit} max={MAX_TABLE_ROWS} onPatch={(limit) => onPatch({ limit })} />
        </>
    );
}

export function MoversSettings({ block, onPatch }: { block: MoversBlock; onPatch: Patch }) {
    return (
        <>
            <Field label="Look in">
                <ScopeField scope={block.scope} onChange={(scope) => onPatch({ scope })} />
            </Field>
            <Field label="Over">
                <Segmented
                    label="Window"
                    value={block.window}
                    options={[
                        { value: '1h', label: '1 hour' },
                        { value: '24h', label: '24 hours' },
                        { value: '7d', label: '7 days' },
                    ]}
                    onChange={(window) => onPatch({ window })}
                />
            </Field>
            <RowsField id={'rows-' + block.id} value={block.limit} max={MAX_LIST_ROWS} onPatch={(limit) => onPatch({ limit })} />
        </>
    );
}

export function ScreenerSettings({ block, onPatch }: { block: ScreenerBlock; onPatch: Patch }) {
    const id = (name: string) => name + '-' + block.id;

    return (
        <>
            <Field label="Look in">
                <ScopeField scope={block.scope} onChange={(scope) => onPatch({ scope })} />
            </Field>
            <Field label="Direction">
                <Segmented
                    label="Direction"
                    value={block.direction}
                    options={[
                        { value: 'up', label: 'Rising' },
                        { value: 'down', label: 'Falling' },
                    ]}
                    onChange={(direction) => onPatch({ direction })}
                />
            </Field>
            <Field label="Moved at least (%)" htmlFor={id('pct')}>
                <NumberField
                    id={id('pct')}
                    value={block.minChangePct}
                    min={0}
                    max={100_000}
                    step={0.5}
                    onChange={(next) => onPatch({ minChangePct: next ?? 0 })}
                />
            </Field>
            <Field label="In the last (hours)" htmlFor={id('hours')} hint={'Up to ' + MAX_SCREENER_HOURS + ' (a week).'}>
                <NumberField
                    id={id('hours')}
                    value={block.windowHours}
                    min={1}
                    max={MAX_SCREENER_HOURS}
                    onChange={(next) => next !== null && onPatch({ windowHours: next })}
                />
            </Field>
            <Field label="At least this many listings" htmlFor={id('liquidity')}>
                <NumberField
                    id={id('liquidity')}
                    value={block.minLiquidity}
                    min={0}
                    max={1_000_000}
                    onChange={(next) => onPatch({ minLiquidity: next ?? 0 })}
                />
            </Field>
            <Field label="Worth at least (divine)" htmlFor={id('divine')} hint="Leave it empty for no floor.">
                <NumberField
                    id={id('divine')}
                    value={block.minDivine}
                    min={0}
                    max={1_000_000}
                    step={0.1}
                    nullable
                    onChange={(minDivine) => onPatch({ minDivine })}
                />
            </Field>
            <RowsField id={id('rows')} value={block.limit} max={MAX_LIST_ROWS} onPatch={(limit) => onPatch({ limit })} />
        </>
    );
}

export function ChartSettings({ block, onPatch }: { block: ChartBlock; onPatch: Patch }) {
    const { scope } = useEconomyContext();
    const quoteIds: Record<Unit, number | undefined> = {
        divine: useUnitItemId(scope, 'divine'),
        exalted: useUnitItemId(scope, 'exalted'),
        chaos: useUnitItemId(scope, 'chaos'),
    };
    const quoted = UNITS.find((unit) => quoteIds[unit] === block.quote);

    return (
        <>
            <Field label="Range">
                <Segmented
                    label="Range"
                    value={block.range}
                    options={[
                        { value: '24h', label: '24 h' },
                        { value: '7d', label: '7 days' },
                        { value: '30d', label: '30 days' },
                        { value: 'league', label: 'League' },
                    ]}
                    onChange={(range) => onPatch({ range })}
                />
            </Field>
            <Field label="Priced in" hint={block.quote !== null && !quoted ? 'Priced in another item. Pick one to change it.' : undefined}>
                <Segmented
                    label="Priced in"
                    value={quoted ?? 'none'}
                    options={[
                        { value: 'none', label: 'Own unit' },
                        // An item priced in itself is a flat line at 1.
                        ...UNITS.map((unit) => ({ value: unit, label: UNIT_LABEL[unit], disabled: quoteIds[unit] === block.item })),
                    ]}
                    onChange={(next) => onPatch({ quote: next === 'none' ? null : (quoteIds[next] ?? block.quote) })}
                    className="[&_button]:px-1.5 [&_button]:text-xs"
                />
            </Field>
        </>
    );
}
