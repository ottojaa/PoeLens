import type { Block, BlockData } from '@poelens/shared';
import { MAX_BLOCK_NAME, MAX_HEADING_LENGTH, MAX_NOTE_LENGTH } from '@poelens/shared';
import { GripVertical, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { BlockPatch } from '@/lib/dashboard/editor';
import { cn } from '@/lib/utils';
import { toItemName, toPairName } from '../blocks/block-format';
import { useSortableItem } from '../dnd';
import { Segmented } from './Segmented';

const KIND_LABEL: Record<Block['type'], string> = { item: 'Item', pair: 'Pair', note: 'Note', heading: 'Heading' };

/** What a block is called in the list: its own name, else what it shows. */
export function toBlockLabel(block: Block, data: BlockData | null | undefined): string {
    if (block.type === 'item') return toItemName(block, data?.type === 'item' ? data : undefined);

    if (block.type === 'pair') return toPairName(block, data?.type === 'pair' ? data : undefined);

    if (block.type === 'heading') return block.text || 'Heading';

    return block.markdown.split('\n').find((line) => line.trim())?.replace(/^[#>*\-\s]+/, '') || 'Note';
}

function NameField({ block, fallback, onPatch }: { block: Extract<Block, { type: 'item' | 'pair' }>; fallback: string; onPatch: (patch: BlockPatch) => void }) {
    const id = 'name-' + block.id;

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-semibold">
                Display name
            </label>
            <Input id={id} value={block.name ?? ''} maxLength={MAX_BLOCK_NAME} placeholder={fallback} onChange={(event) => onPatch({ name: event.target.value || undefined })} />
            <span className="text-muted-foreground text-xs">{block.name ? 'Shown instead of “' + fallback + '”.' : 'Empty, so it shows “' + fallback + '”.'}</span>
        </div>
    );
}

function BlockSettings({ block, fallback, onPatch }: { block: Block; fallback: string; onPatch: (patch: BlockPatch) => void }) {
    if (block.type === 'note') {
        return (
            <div className="flex flex-col gap-1.5">
                <label htmlFor={'note-' + block.id} className="text-sm font-semibold">
                    Text <span className="text-muted-foreground font-normal">· Markdown</span>
                </label>
                <Textarea
                    id={'note-' + block.id}
                    value={block.markdown}
                    maxLength={MAX_NOTE_LENGTH}
                    className="min-h-14 font-mono"
                    onChange={(event) => onPatch({ markdown: event.target.value })}
                />
            </div>
        );
    }

    if (block.type === 'heading') {
        return (
            <div className="flex flex-col gap-1.5">
                <label htmlFor={'heading-' + block.id} className="text-sm font-semibold">
                    Heading
                </label>
                <Input id={'heading-' + block.id} value={block.text} maxLength={MAX_HEADING_LENGTH} onChange={(event) => onPatch({ text: event.target.value })} />
                <span className="text-muted-foreground text-xs">Leave it empty for a plain divider.</span>
            </div>
        );
    }

    return (
        <>
            <NameField block={block} fallback={fallback} onPatch={onPatch} />
            {block.type === 'item' && (
                <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold">Display</span>
                    <Segmented
                        label="Display"
                        value={block.display}
                        onChange={(display) => onPatch({ display })}
                        options={[
                            { value: 'compact', label: 'Compact' },
                            { value: 'card', label: 'Card' },
                        ]}
                    />
                </div>
            )}
        </>
    );
}

/** One block in the content sheet: grab it to reorder, the gear opens its settings, the cross removes it. */
export function BlockRow({
    block,
    index,
    data,
    open,
    onToggle,
    onPatch,
    onRemove,
}: {
    block: Block;
    index: number;
    data: BlockData | null | undefined;
    open: boolean;
    onToggle: () => void;
    onPatch: (patch: BlockPatch) => void;
    onRemove: () => void;
}) {
    const { ref, handleRef, isDragging } = useSortableItem(block.id, index);
    const label = toBlockLabel(block, data);
    const defaultLabel = block.type === 'note' || block.type === 'heading' ? label : toBlockLabel({ ...block, name: undefined }, data);

    return (
        <li ref={ref} className={cn('flex flex-col gap-1.5', isDragging && 'opacity-60')}>
            <div className={cn('bg-card flex min-h-9 items-center gap-2 rounded-lg border py-0 pr-0.5 pl-2', open && 'border-primary')}>
                <span ref={handleRef} aria-hidden="true" className="text-muted-foreground cursor-grab touch-none">
                    <GripVertical className="size-4" />
                </span>
                <span
                    className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        block.type === 'pair' ? 'bg-primary text-primary-foreground' : 'border-input text-muted-foreground border',
                    )}
                >
                    {KIND_LABEL[block.type]}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn('size-7', open ? 'bg-accent text-primary' : 'text-muted-foreground')}
                    aria-label={'Settings for ' + label}
                    aria-expanded={open}
                    onClick={onToggle}
                >
                    <Settings aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="text-muted-foreground size-7" aria-label={'Remove ' + label} onClick={onRemove}>
                    <X aria-hidden="true" />
                </Button>
            </div>
            {open && (
                <div className="bg-card ml-5 flex flex-col gap-3 rounded-[10px] border p-3">
                    <BlockSettings block={block} fallback={defaultLabel} onPatch={onPatch} />
                </div>
            )}
        </li>
    );
}
