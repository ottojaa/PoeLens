import { motion } from 'motion/react';
import type { CSSProperties, ReactNode, Ref } from 'react';
import { SPRING } from './tokens';

/**
 * A panel on the dashboard grid. When the grid places it somewhere new (another panel moved or was resized,
 * or it was dragged), it glides there on the shared spring. Only its position animates, so a panel that changes size
 * snaps to the new size instead of squashing its contents while it settles. Reduced motion snaps both.
 */
export function GridPanel({
    children,
    style,
    className,
    panelRef,
    animate,
    label,
}: {
    children: ReactNode;
    style: CSSProperties;
    className?: string;
    panelRef?: Ref<HTMLElement>;
    /** False while the pointer is dragging the panel itself: it follows the pointer rather than gliding behind it. */
    animate: boolean;
    label: string;
}) {
    return (
        <motion.section ref={panelRef} aria-label={label} layout={animate ? 'position' : false} transition={SPRING} style={style} className={className}>
            {children}
        </motion.section>
    );
}
