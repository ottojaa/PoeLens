import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { POP_SPRING } from './tokens';

/** Wraps a toggle's icon so that it springs from a slightly smaller size each time `state` changes. */
export function TogglePop({ state, children }: { state: string | boolean; children: ReactNode }) {
    return (
        <motion.span
            key={String(state)}
            className="inline-flex"
            initial={{ scale: 0.6, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={POP_SPRING}
        >
            {children}
        </motion.span>
    );
}
