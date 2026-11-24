import { useCallback, useSyncExternalStore } from 'react';

/** Whether a CSS media query matches right now, and again whenever it starts or stops matching. */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (notify: () => void) => {
            const list = window.matchMedia(query);

            list.addEventListener('change', notify);

            return () => list.removeEventListener('change', notify);
        },
        [query],
    );

    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
