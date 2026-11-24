import type { BlockData, Panel as PanelModel } from '@poelens/shared';
import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { BlockView } from './blocks/BlockView';
import { UnitMark } from './blocks/UnitMark';

export type PanelMode = 'view' | 'layout' | 'content';

/** The panel's fixed unit, when it has one: the tile and the name, e.g. "E Exalted". */
function UnitPill({ unit }: { unit: NonNullable<PanelModel['unit']> }) {
    return (
        <span
            className="border-input text-muted-foreground flex shrink-0 items-center gap-1.5 rounded-full border py-0.5 pr-2 pl-1 text-[11px] font-semibold"
            title={unit === 'auto' ? 'Prices in this panel read in the unit that suits each' : 'Prices in this panel are in ' + unit}
        >
            {unit !== 'auto' && <UnitMark unit={unit} />}
            <span className="capitalize">{unit}</span>
        </span>
    );
}

function PanelMenu({ title, onEditContent }: { title: string; onEditContent: () => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="text-muted-foreground size-7 shrink-0" aria-label={'More for ' + title}>
                    <MoreHorizontal aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEditContent}>Edit content</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * One panel: a titled card holding its blocks. `bar` and `resizeHandle` are the layout editing chrome, drawn by the
 * editor. The body is a size container, so blocks show a trend line or a table column only when the panel is wide enough.
 */
export function Panel({
    panel,
    data,
    mode,
    selected,
    openBlockId,
    fitContent,
    bar,
    resizeHandle,
    onEditContent,
}: {
    panel: PanelModel;
    data: Record<string, BlockData | null> | undefined;
    mode: PanelMode;
    /** In content mode, the one panel being edited. */
    selected: boolean;
    openBlockId?: string | null;
    /** On a phone the panel grows to fit its blocks instead of scrolling inside a fixed height. */
    fitContent: boolean;
    bar?: ReactNode;
    resizeHandle?: ReactNode;
    onEditContent: () => void;
}) {
    const dimmed = mode === 'content' && !selected;

    return (
        <div
            className={cn(
                'bg-card relative flex min-h-0 flex-col overflow-hidden rounded-xl border',
                mode === 'layout' && 'border-input border-dashed',
                mode === 'content' && selected && 'border-primary border-2 shadow-xl',
                dimmed && 'opacity-35',
                !fitContent && 'h-full',
            )}
        >
            {mode === 'layout' && bar}
            <div className="flex min-h-[30px] shrink-0 items-center gap-2 pt-2.5 pr-2 pb-1 pl-4">
                <h2 className="m-0 min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">{panel.title}</h2>
                {panel.hideOnPhone && mode !== 'view' && (
                    <span className="border-input text-muted-foreground max-w-[45%] min-w-0 truncate rounded-full border px-1.5 text-[11px] font-semibold">
                        Hidden on phone
                    </span>
                )}
                {panel.unit && <UnitPill unit={panel.unit} />}
                <PanelMenu title={panel.title} onEditContent={onEditContent} />
            </div>
            <div className={cn('@container px-1 pb-1.5', !fitContent && 'min-h-0 flex-1 overflow-y-auto')}>
                {panel.blocks.length === 0 && <p className="text-muted-foreground px-3 py-2.5 text-[13px]">No blocks yet</p>}
                {panel.blocks.map((block, index) => (
                    <BlockView
                        key={block.id}
                        block={block}
                        data={data === undefined ? undefined : (data[block.id] ?? null)}
                        previous={panel.blocks[index - 1]}
                        outline={mode === 'content' && selected && openBlockId !== undefined ? (block.id === openBlockId ? 'open' : 'idle') : undefined}
                    />
                ))}
            </div>
            {mode === 'layout' && resizeHandle}
        </div>
    );
}
