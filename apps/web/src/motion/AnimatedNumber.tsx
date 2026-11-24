import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { countTo, type NumberFormatter } from './number';

/**
 * A number that counts to its new value over 400ms and underlines itself once in the accent colour. The count writes
 * straight to the text node, so a price updating does not re-render the component around it. Screen readers get the
 * final value only, not the count.
 */
export function AnimatedNumber({ value, format = String, className }: { value: number; format?: NumberFormatter; className?: string }) {
    const textRef = useRef<HTMLSpanElement>(null);
    const underlineRef = useRef<HTMLSpanElement>(null);
    const shownRef = useRef<number | null>(null);
    const reduceMotion = useReducedMotion() ?? false;

    useEffect(() => {
        const previous = shownRef.current;

        shownRef.current = value;

        if (previous === null) return;

        // Restart the underline: the keyframes live in CSS, so the class is removed, reflowed and set again.
        if (!reduceMotion) flash(underlineRef.current);

        return countTo({
            from: previous,
            to: value,
            format,
            instant: reduceMotion,
            onUpdate: (text) => {
                if (textRef.current) textRef.current.textContent = text;
            },
        });
    }, [value, format, reduceMotion]);

    return (
        <span className={'relative inline-block ' + (className ?? '')}>
            <span ref={textRef} aria-hidden="true">
                {format(value)}
            </span>
            <span className="sr-only">{format(value)}</span>
            <span
                ref={underlineRef}
                aria-hidden="true"
                className="bg-primary pointer-events-none absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 opacity-0"
            />
        </span>
    );
}

function flash(element: HTMLElement | null) {
    if (!element) return;

    element.classList.remove('number-flash');
    void element.offsetWidth;
    element.classList.add('number-flash');
}
