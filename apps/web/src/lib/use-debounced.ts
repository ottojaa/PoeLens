import { useCallback, useEffect, useRef, useState } from 'react';

/** The value, once it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);

        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
}

/**
 * Text for an input whose value also lives in the URL. Typing shows at once and reaches the URL after a pause; a URL
 * that changes by other means (back, "clear filters") replaces the text, but the URL catching up with what was just
 * typed does not, so characters typed during the pause are never overwritten.
 */
export function useUrlBackedText(urlValue: string, push: (value: string) => void, delayMs = 250): [string, (value: string) => void] {
    const [text, setText] = useState(urlValue);
    const lastPushed = useRef(urlValue);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const pushRef = useRef(push);

    useEffect(() => {
        pushRef.current = push;
    });

    useEffect(() => {
        if (urlValue === lastPushed.current) return;

        clearTimeout(timer.current);
        lastPushed.current = urlValue;
        setText(urlValue);
    }, [urlValue]);

    useEffect(() => () => clearTimeout(timer.current), []);

    const change = useCallback(
        (next: string) => {
            setText(next);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => {
                lastPushed.current = next;
                pushRef.current(next);
            }, delayMs);
        },
        [delayMs],
    );

    return [text, change];
}
