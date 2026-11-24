import { useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { countTo, hasChanged, type NumberFormatter } from './number';

/**
 * A number that counts to its new value over 400ms and underlines itself once in the accent colour. The count runs
 * through a MotionValue and writes straight to the text node, so a price updating does not re-render the component
 * around it. Screen readers get the final value only, not the count. A render with the same value does nothing.
 */
export function AnimatedNumber({ value, format = String, className }: { value: number; format?: NumberFormatter; className?: string }) {
    const textRef = useRef<HTMLSpanElement>(null);
    const underlineRef = useRef<HTMLSpanElement>(null);
    const shownRef = useRef<number | null>(null);
    const formatRef = useRef(format);
    const motionValue = useMotionValue(value);
    const reduceMotion = useReducedMotion() ?? false;
    // The text node is written by the effects below, so React must never see its content change after the first render.
    const [initialText] = useState(() => format(value));

    useEffect(() => {
        formatRef.current = format;

        if (textRef.current) textRef.current.textContent = format(motionValue.get());
    }, [format, motionValue]);

    useEffect(
        () =>
            motionValue.on('change', (latest) => {
                if (textRef.current) textRef.current.textContent = formatRef.current(latest);
            }),
        [motionValue],
    );

    useEffect(() => {
        const previous = shownRef.current;

        shownRef.current = value;

        if (!hasChanged(previous, value)) return;

        // Restart the underline: the keyframes live in CSS, so the class is removed, reflowed and set again.
        if (!reduceMotion) flash(underlineRef.current);

        return countTo(motionValue, value, reduceMotion);
    }, [value, reduceMotion, motionValue]);

    return (
        <span className={'relative inline-block ' + (className ?? '')}>
            <span ref={textRef} aria-hidden="true">
                {initialText}
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
