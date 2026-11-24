import type { ItemRef } from '@poelens/shared';

/** What a list needs to draw its stars: who is watched, and how to (un)watch. Built once per view by `useWatchlist`. */
export interface WatchControls {
    /** False until the first answer has arrived: before that `isWatched` says no to everything, which a button must not show as fact. */
    isReady: boolean;
    isWatched: (itemId: number) => boolean;
    onToggle: (item: ItemRef, watched: boolean) => void;
}
