import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { DURATION, EASE_OUT, SPRING } from './tokens';

/**
 * Layout animation measures every item on each render, so it is for short lists (a watchlist, a shortlist of
 * results), never the economy table with hundreds of rows. Above this many items the list renders without it.
 */
export const MAX_ANIMATED_ITEMS = 50;

export function canAnimateLayout(count: number): boolean {
    return count <= MAX_ANIMATED_ITEMS;
}

/** The motion props of a list row that glides into place and fades out when removed (a `motion.tr` in a table). */
export const GLIDING_ROW_PROPS = {
    layout: 'position',
    initial: false,
    exit: { opacity: 0 },
    transition: { layout: SPRING, opacity: { duration: DURATION.menu, ease: EASE_OUT } },
} as const;

/** A list whose items glide to their new place when the order changes, and fade in and out as they come and go. */
export function AnimatedList<T>({
    items,
    getKey,
    renderItem,
    className,
}: {
    items: readonly T[];
    getKey: (item: T) => string;
    renderItem: (item: T) => ReactNode;
    className?: string;
}) {
    const animated = canAnimateLayout(items.length);

    return (
        <ul className={className}>
            <AnimatePresence initial={false}>
                {items.map((item) => (
                    <motion.li
                        key={getKey(item)}
                        layout={animated ? 'position' : false}
                        initial={animated ? { opacity: 0 } : false}
                        animate={{ opacity: 1 }}
                        exit={animated ? { opacity: 0 } : undefined}
                        transition={{ layout: SPRING, opacity: { duration: DURATION.menu, ease: EASE_OUT } }}
                    >
                        {renderItem(item)}
                    </motion.li>
                ))}
            </AnimatePresence>
        </ul>
    );
}
