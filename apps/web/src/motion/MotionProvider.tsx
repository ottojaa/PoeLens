import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Honours the visitor's reduced-motion setting for every Motion component below: transforms (the page rise, layout
 * glides, the toggle pop) are dropped and opacity changes stay. The imperative `animate` calls Motion does not
 * govern, so `AnimatedNumber` checks the setting itself. CSS overlay animations are covered in `motion.css`.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
    return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
