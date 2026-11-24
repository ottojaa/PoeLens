import { useMediaQuery } from '@/lib/use-media-query';

/**
 * Whether the 12-column grid has room to show panels as drawn. The sidebar takes 240px from 768px up, so the grid is
 * only about 500px wide at 800px and a 4-column panel would be too narrow for a pair row; from 1024px a 4-column panel
 * is about 230px. Below that the panels stack in one column, as on a phone, and the layout is not edited.
 */
export function useWideGrid(): boolean {
    return useMediaQuery('(min-width: 1024px)');
}
