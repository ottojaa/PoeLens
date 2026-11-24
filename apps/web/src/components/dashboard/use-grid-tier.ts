import { useMediaQuery } from '@/lib/use-media-query';

/**
 * How the page lays panels out: the 12-column `desktop` grid (the only place a dashboard is edited) from 1024px, a
 * two-column `tablet` flow from 768px, where the sidebar appears, and a one-column `phone` stack below.
 */
export type GridTier = 'desktop' | 'tablet' | 'phone';

export function useGridTier(): GridTier {
    const desktop = useMediaQuery('(min-width: 1024px)');
    const tablet = useMediaQuery('(min-width: 768px)');

    if (desktop) return 'desktop';

    return tablet ? 'tablet' : 'phone';
}
