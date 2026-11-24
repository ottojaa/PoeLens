import { animate, type MotionValue } from 'motion/react';
import { DURATION, EASE_OUT } from './tokens';

export type NumberFormatter = (value: number) => string;

/** A number only counts and flashes when it is shown before and has a different value now. */
export function hasChanged(previous: number | null, next: number): previous is number {
    return previous !== null && previous !== next;
}

/**
 * Moves a MotionValue to `to` over the number duration, starting from wherever it is now, so a count interrupted
 * half way continues from the number on screen. With `instant` it jumps. Returns a function that stops the count.
 */
export function countTo(value: MotionValue<number>, to: number, instant: boolean): () => void {
    if (instant) {
        value.jump(to);

        return () => undefined;
    }

    const controls = animate(value, to, { duration: DURATION.number, ease: EASE_OUT });

    return () => controls.stop();
}
