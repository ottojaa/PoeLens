import { animate } from 'motion/react';
import { DURATION, EASE_OUT } from './tokens';

export type NumberFormatter = (value: number) => string;

/**
 * Counts from one number to another, calling `onUpdate` with each step's text and `onDone` once at the end. With
 * `instant` it jumps straight to the target. Returns a function that stops the count.
 */
export function countTo(options: {
    from: number;
    to: number;
    format: NumberFormatter;
    instant: boolean;
    onUpdate: (text: string) => void;
    onDone?: () => void;
}): () => void {
    const { from, to, format, instant, onUpdate, onDone } = options;

    if (instant || from === to) {
        onUpdate(format(to));
        onDone?.();

        return () => undefined;
    }

    const controls = animate(from, to, {
        duration: DURATION.number,
        ease: EASE_OUT,
        onUpdate: (value) => onUpdate(format(value)),
        onComplete: () => {
            onUpdate(format(to));
            onDone?.();
        },
    });

    return () => controls.stop();
}
