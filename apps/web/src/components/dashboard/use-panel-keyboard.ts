import { nudge, stretch, type Panel } from '@poelens/shared';
import { useRef, useState, type KeyboardEvent } from 'react';
import { toKeyStep } from '@/lib/dashboard/geometry';

/**
 * Keyboard moving and resizing of panels. Enter or Space picks a focused panel up; arrow keys move it a cell, Shift with
 * an arrow resizes it a cell; Enter or Space drops it; Escape puts everything back as it was when it was picked up.
 */
export function usePanelKeyboard(panels: readonly Panel[], onLayout: (panels: Panel[]) => void) {
    const [pickedId, setPickedId] = useState<string | null>(null);
    const before = useRef<Panel[]>([]);

    function drop() {
        setPickedId(null);
    }

    function onKeyDown(panel: Panel, event: KeyboardEvent<HTMLElement>) {
        if (event.target !== event.currentTarget) return;

        const isConfirm = event.key === 'Enter' || event.key === ' ';

        if (pickedId !== panel.id) {
            if (!isConfirm) return;

            event.preventDefault();
            before.current = [...panels];
            setPickedId(panel.id);

            return;
        }

        if (isConfirm) {
            event.preventDefault();
            drop();

            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            onLayout(before.current);
            drop();

            return;
        }

        const step = toKeyStep(event.key, event.shiftKey);

        if (!step) return;

        event.preventDefault();
        onLayout(step.kind === 'move' ? nudge(panels, panel.id, step.dx, step.dy) : stretch(panels, panel.id, step.dx, step.dy));
    }

    const picked = panels.find((panel) => panel.id === pickedId);
    const status = picked
        ? picked.title + ': column ' + (picked.x + 1) + ', row ' + (picked.y + 1) + ', ' + picked.w + ' columns wide, ' + picked.h + ' rows tall'
        : '';

    return { pickedId, onKeyDown, drop, status };
}
