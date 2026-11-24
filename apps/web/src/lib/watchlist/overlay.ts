import { MAX_WATCHLIST_ITEMS } from '@poelens/shared';

/** Anything about one item; the overlay only needs its id. */
interface HasItem {
    item: { id: number };
}

/** One toggle that has been asked for and not yet settled: the state the user wants the item in. */
export interface PendingToggle {
    itemId: number;
    watched: boolean;
}

/** The state wanted per item while requests are pending. The latest request for an item wins. */
export function toWantedStates(pending: readonly PendingToggle[]): ReadonlyMap<number, boolean> {
    return new Map(pending.map((toggle) => [toggle.itemId, toggle.watched]));
}

/**
 * The ids on the watchlist as the user sees them: what the server says, with the pending toggles applied. The set (not
 * the server's count plus the pending changes) is what is counted: right after a request lands, the answer on screen
 * already holds the new item while the request is still pending, and adding the pending add on top would count it twice.
 */
export function toWatchedIds(rows: readonly HasItem[], unlisted: readonly HasItem[], wanted: ReadonlyMap<number, boolean>): ReadonlySet<number> {
    const ids = new Set([...rows, ...unlisted].map((entry) => entry.item.id));

    for (const [itemId, watched] of wanted) {
        if (watched) ids.add(itemId);
        else ids.delete(itemId);
    }

    return ids;
}

/** Whether another item would be refused; a pending add of an item already watched does not fill the list. */
export function isFullList(count: number): boolean {
    return count >= MAX_WATCHLIST_ITEMS;
}

/** The entries of the answer that are not waiting to be removed, so a star pressed off animates its row out at once. */
export function withoutPendingRemovals<T extends HasItem>(entries: readonly T[], wanted: ReadonlyMap<number, boolean>): T[] {
    return entries.filter((entry) => wanted.get(entry.item.id) !== false);
}
