/**
 * The one place `@dnd-kit` is imported. Panels use it only for pointer travel: the grid engine decides where they land,
 * so dnd-kit never moves the element itself. Tab and block lists use its sortable, which does move them.
 */
import { Feedback, PointerSensor } from '@dnd-kit/dom';
import { DragDropProvider, useDraggable } from '@dnd-kit/react';
import { isSortableOperation, useSortable } from '@dnd-kit/react/sortable';
import type { ReactNode } from 'react';

export type GestureKind = 'move' | 'resize';

export interface GestureHandlers {
    onStart: (id: string, kind: GestureKind) => void;
    /** The pointer's total travel since the gesture began, in pixels. */
    onMove: (id: string, kind: GestureKind, dx: number, dy: number) => void;
    onEnd: (id: string, kind: GestureKind, canceled: boolean) => void;
}

interface GestureData {
    panelId: string;
    kind: GestureKind;
}

function toGestureData(data: unknown): GestureData | undefined {
    if (typeof data !== 'object' || data === null) return undefined;

    const { panelId, kind } = data as Partial<GestureData>;

    if (typeof panelId !== 'string' || (kind !== 'move' && kind !== 'resize')) return undefined;

    return { panelId, kind };
}

/** Reports the pointer travel of every panel gesture beneath it. */
export function PanelGestures({ handlers, children }: { handlers: GestureHandlers; children: ReactNode }) {
    return (
        <DragDropProvider
            onDragStart={(event) => {
                const gesture = toGestureData(event.operation.source?.data);

                if (gesture) handlers.onStart(gesture.panelId, gesture.kind);
            }}
            onDragMove={(event) => {
                const gesture = toGestureData(event.operation.source?.data);

                if (gesture) handlers.onMove(gesture.panelId, gesture.kind, event.operation.transform.x, event.operation.transform.y);
            }}
            onDragEnd={(event) => {
                const gesture = toGestureData(event.operation.source?.data);

                if (gesture) handlers.onEnd(gesture.panelId, gesture.kind, event.canceled);
            }}
        >
            {children}
        </DragDropProvider>
    );
}

/** The handle that moves or resizes a panel with the pointer. Feedback is off: the grid re-places the real panel. */
export function usePanelGesture(panelId: string, kind: GestureKind, disabled: boolean) {
    const { handleRef, isDragging } = useDraggable({
        id: kind + ':' + panelId,
        data: { panelId, kind } satisfies GestureData,
        disabled,
        sensors: [PointerSensor],
        plugins: [Feedback.configure({ feedback: 'none' })],
    });

    return { handleRef, isDragging };
}

function toReordered<T>(items: readonly T[], from: number, to: number): T[] {
    const next = items.filter((_, index) => index !== from);
    const moved = items[from];

    if (moved === undefined) return [...items];

    return [...next.slice(0, to), moved, ...next.slice(to)];
}

/** A list whose items can be dragged into a new order; `onReorder` gets the ids in their new order. */
export function SortableList({ ids, onReorder, children }: { ids: readonly string[]; onReorder: (ids: string[]) => void; children: ReactNode }) {
    return (
        <DragDropProvider
            onDragEnd={(event) => {
                if (event.canceled || !isSortableOperation(event.operation)) return;

                const { source } = event.operation;

                if (!source || source.initialIndex === source.index) return;

                onReorder(toReordered(ids, source.initialIndex, source.index));
            }}
        >
            {children}
        </DragDropProvider>
    );
}

/** One item of a `SortableList`. `handleRef` goes on the part of the item that is grabbed, `ref` on the item. */
export function useSortableItem(id: string, index: number) {
    const { ref, handleRef, isDragging } = useSortable({ id, index });

    return { ref, handleRef, isDragging };
}
