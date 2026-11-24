import { useEffect, useRef, useState } from 'react';

/** The width of an element in pixels, kept current as it resizes. `ref` goes on the element. */
export function useElementWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const element = ref.current;

        if (!element) return;

        const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return { ref, width };
}
