import { motion, PresenceContext } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { POP_SPRING } from './tokens';

/**
 * Wraps a toggle's icon so that it springs from a slightly smaller size each time `state` changes. The first render does
 * not pop: a table of a few hundred stars would otherwise animate every one of them on load.
 *
 * The pop is cut off from any `AnimatePresence` above it. A list that skips its first-render animation
 * (`initial={false}`) would otherwise pass that on to the icon, which would then never pop inside a row.
 */
export function TogglePop({ state, children }: { state: string | boolean; children: ReactNode }) {
    const hasMounted = useRef(false);
    const isChange = hasMounted.current;

    useEffect(() => {
        hasMounted.current = true;
    }, []);

    return (
        <PresenceContext.Provider value={null}>
            <motion.span
                key={String(state)}
                className="inline-flex"
                initial={isChange ? { scale: 0.6, rotate: -30, opacity: 0 } : false}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={POP_SPRING}
            >
                {children}
            </motion.span>
        </PresenceContext.Provider>
    );
}
