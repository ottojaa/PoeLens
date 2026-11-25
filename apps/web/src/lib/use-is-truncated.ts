import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Whether an element's text is cut off with an ellipsis, kept up to date as it resizes. Hide the text with `invisible`
 * rather than `hidden` when acting on it: the element keeps its size, so the answer does not flip back.
 */
export function useIsTruncated<T extends HTMLElement>(text: string): { ref: RefObject<T | null>; truncated: boolean } {
    const ref = useRef<T>(null);
    const [truncated, setTruncated] = useState(false);

    useLayoutEffect(() => {
        const element = ref.current;

        if (!element) return;

        const measure = () => setTruncated(element.scrollWidth > element.clientWidth);

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(element);

        return () => observer.disconnect();
    }, [text]);

    return { ref, truncated };
}
