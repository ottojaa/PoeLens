import { useMatches } from '@tanstack/react-router';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { DURATION, EASE_OUT } from './tokens';

/**
 * Fades a page in and lifts it 8px into place when the route changes. Enter only: there is no exit animation, because
 * holding the old page on screen while the new one loads would make every navigation feel slower.
 */
export function PageTransition({ children }: { children: ReactNode }) {
    const matches = useMatches();
    const routeId = matches[matches.length - 1]?.routeId ?? 'none';

    return (
        <motion.div key={routeId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.page, ease: EASE_OUT }}>
            {children}
        </motion.div>
    );
}
