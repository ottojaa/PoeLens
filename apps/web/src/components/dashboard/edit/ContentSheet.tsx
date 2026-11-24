import { MAX_BLOCKS, MAX_PANEL_TITLE, type Block, type BlockData, type Panel, type Unit, type UnitChoice } from '@poelens/shared';
import { ArrowLeft } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Segmented } from '@/components/ui/segmented';
import type { BlockPatch, PanelPatch } from '@/lib/dashboard/editor';
import type { PriceScope } from '@/lib/api/prices';
import { UNIT_LABEL } from '@/lib/economy/units';
import { SortableList } from '../dnd';
import { AddBlockMenu } from './AddBlockMenu';
import { BlockRow } from './BlockRow';

type PanelUnit = 'same' | UnitChoice;

const UNIT_CHOICES: readonly { value: PanelUnit; label: string }[] = [
    { value: 'same', label: 'Same as page' },
    { value: 'auto', label: 'Auto' },
    { value: 'divine', label: 'Divine' },
    { value: 'exalted', label: 'Exalted' },
    { value: 'chaos', label: 'Chaos' },
];

function toUnitLabel(unit: UnitChoice): string {
    return unit === 'auto' ? 'Auto' : UNIT_LABEL[unit];
}

/** The unit a pair added to the panel is priced in: the panel's own unit, else the page's, with Auto meaning Divine. */
function toPairUnit(panel: Panel, headerUnit: UnitChoice): Unit {
    const unit = panel.unit ?? headerUnit;

    return unit === 'auto' ? 'divine' : unit;
}

function PanelSettings({
    panel,
    headerUnit,
    onPatch,
    onDelete,
}: {
    panel: Panel;
    headerUnit: UnitChoice;
    onPatch: (patch: PanelPatch) => void;
    onDelete: () => void;
}) {
    const value: PanelUnit = panel.unit ?? 'same';
    const hint =
        value === 'same'
            ? 'Follows the unit picked at the top of the page (now ' + toUnitLabel(headerUnit) + '). A pair always shows in its second item.'
            : 'Items in this panel show in ' + toUnitLabel(value) + ', whatever the header says. A pair always shows in its second item.';

    return (
        <section aria-label="Panel settings" className="flex flex-col gap-3 border-t pt-3.5">
            <h3 className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">Panel settings</h3>
            <div className="flex flex-col gap-1.5">
                <label htmlFor="panel-title" className="text-sm font-semibold">
                    Title
                </label>
                <Input id="panel-title" value={panel.title} maxLength={MAX_PANEL_TITLE} onChange={(event) => onPatch({ title: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">Unit</span>
                <Segmented
                    label="Panel unit"
                    value={value}
                    options={UNIT_CHOICES}
                    onChange={(next) => onPatch({ unit: next === 'same' ? null : next })}
                    className="[&_button]:px-1.5 [&_button]:text-xs"
                />
                <span className="text-muted-foreground text-xs leading-snug">{hint}</span>
            </div>
            <div className="flex items-center gap-3">
                <label htmlFor="hide-phone" className="flex flex-1 cursor-pointer flex-col gap-0.5">
                    <span className="text-sm font-semibold">Hide on phone</span>
                    <span className="text-muted-foreground text-xs">Wider screens still show it.</span>
                </label>
                <Switch id="hide-phone" checked={panel.hideOnPhone} onCheckedChange={(hideOnPhone) => onPatch({ hideOnPhone })} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-3">
                <Button type="button" variant="outline" className="text-destructive" onClick={onDelete}>
                    Delete panel
                </Button>
                <span className="text-muted-foreground text-right text-xs">The panel updates as you go.</span>
            </div>
        </section>
    );
}

/**
 * The side sheet where one panel's content is edited: its blocks, and its own settings. The page stays live beside it,
 * so the panel updates as you type; it is not a modal.
 */
export function ContentSheet({
    panel,
    data,
    scope,
    openBlockId,
    onOpenBlock,
    onClose,
    onPatchPanel,
    onAddBlock,
    onPatchBlock,
    onRemoveBlock,
    onMoveBlock,
    onDeletePanel,
}: {
    panel: Panel;
    data: Record<string, BlockData | null | undefined>;
    scope: PriceScope;
    /** The block whose settings are open: held by the page, which outlines it on the panel. */
    openBlockId: string | undefined;
    onOpenBlock: (id: string | undefined) => void;
    onClose: () => void;
    onPatchPanel: (patch: PanelPatch) => void;
    onAddBlock: (block: Block) => void;
    onPatchBlock: (blockId: string, patch: BlockPatch) => void;
    onRemoveBlock: (blockId: string) => void;
    onMoveBlock: (from: number, to: number) => void;
    onDeletePanel: () => void;
}) {
    const full = panel.blocks.length >= MAX_BLOCKS;

    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };

    return (
        <aside
            role="dialog"
            aria-label={'Content of ' + panel.title}
            onKeyDown={onKeyDown}
            className="bg-popover fixed inset-0 z-50 flex flex-col gap-3.5 overflow-y-auto border-l p-4 shadow-lg sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:z-20 sm:h-[calc(100dvh-var(--header-height)-100%)] sm:w-[400px]"
        >
            <header className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">Panel content</span>
                    <h2 className="truncate text-lg font-semibold">{panel.title}</h2>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onClose} aria-label="Back to layout" className="gap-1.5">
                    <ArrowLeft aria-hidden="true" />
                    Layout
                </Button>
            </header>
            <div className="flex items-center gap-2">
                <h3 className="text-muted-foreground flex-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
                    Blocks · {panel.blocks.length}
                    {panel.blocks.length > 1 && ' · drag to reorder'}
                </h3>
                <AddBlockMenu scope={scope} unit={toPairUnit(panel, scope.unit)} disabled={full} onAdd={onAddBlock} />
            </div>
            {panel.blocks.length === 0 && <p className="text-muted-foreground text-sm">No blocks yet. Add an item, a pair, a note or a heading.</p>}
            <SortableList ids={panel.blocks.map((block) => block.id)} onReorder={(_ids, from, to) => onMoveBlock(from, to)}>
                <ul className="flex flex-col gap-1.5">
                    {panel.blocks.map((block, index) => (
                        <BlockRow
                            key={block.id}
                            block={block}
                            index={index}
                            data={data[block.id]}
                            open={openBlockId === block.id}
                            onToggle={() => onOpenBlock(openBlockId === block.id ? undefined : block.id)}
                            onPatch={(patch) => onPatchBlock(block.id, patch)}
                            onRemove={() => onRemoveBlock(block.id)}
                        />
                    ))}
                </ul>
            </SortableList>
            <div className="mt-auto" />
            <PanelSettings panel={panel} headerUnit={scope.unit} onPatch={onPatchPanel} onDelete={onDeletePanel} />
        </aside>
    );
}
