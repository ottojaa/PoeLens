import type { Panel } from '@poelens/shared';
import { GripVertical, Pencil } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePanelGesture } from '../dnd';

/** "6 columns · 10 rows": what a panel measures, shown on its bar while the layout is edited. */
export function toSizeText(panel: Pick<Panel, 'w' | 'h'>): string {
    return panel.w + ' columns · ' + panel.h + ' rows';
}

/** "6×10": the same size in less room, for a bar too narrow for the words. */
export function toShortSizeText(panel: Pick<Panel, 'w' | 'h'>): string {
    return panel.w + '×' + panel.h;
}

/**
 * The bar across the top of a panel in Layout mode. Dragging it moves the panel; focusing it and pressing Enter picks the
 * panel up, then arrows move it and Shift with arrows resizes it.
 */
export function PanelBar({
    panel,
    picked,
    onKeyDown,
    onBlur,
    onEditContent,
}: {
    panel: Panel;
    picked: boolean;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onBlur: () => void;
    onEditContent: () => void;
}) {
    const { handleRef, isDragging } = usePanelGesture(panel.id, 'move', false);

    return (
        <div
            ref={handleRef}
            role="button"
            tabIndex={0}
            aria-pressed={picked}
            aria-label={'Move ' + panel.title}
            aria-description="Press Enter to pick up. Then arrow keys move, Shift and arrow keys resize, Enter drops, Escape cancels."
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            className={cn(
                '@container bg-popover border-border focus-visible:ring-ring/50 flex h-[30px] shrink-0 cursor-grab touch-none items-center gap-2 border-b pr-1.5 pl-2.5 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-inset',
                (picked || isDragging) && 'bg-accent cursor-grabbing',
            )}
        >
            <GripVertical aria-hidden="true" className="text-muted-foreground size-3.5 shrink-0" />
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                <span className="@max-[240px]:hidden">{toSizeText(panel)}</span>
                <span className="hidden @max-[240px]:inline" title={toSizeText(panel)}>
                    {toShortSizeText(panel)}
                </span>
            </span>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-[22px] gap-1 rounded-md px-2 text-xs font-semibold"
                aria-label={'Edit the content of ' + panel.title}
                onClick={onEditContent}
            >
                <Pencil aria-hidden="true" className="size-3" />
                Content
            </Button>
        </div>
    );
}

/** The corner handle that resizes a panel with the pointer. Keyboard users resize from the bar. */
export function ResizeHandle({ panel }: { panel: Panel }) {
    const { handleRef } = usePanelGesture(panel.id, 'resize', false);

    return (
        <span
            ref={handleRef}
            aria-hidden="true"
            title={'Resize ' + panel.title}
            className="bg-popover absolute right-[3px] bottom-[3px] grid size-[18px] cursor-nwse-resize touch-none place-items-center rounded-[5px]"
        >
            <svg width="14" height="14" viewBox="0 0 14 14" className="text-muted-foreground">
                <path d="M12 4L4 12M12 8.5L8.5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            </svg>
        </span>
    );
}
