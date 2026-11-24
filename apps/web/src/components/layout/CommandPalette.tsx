import { CATEGORIES } from '@poelens/shared';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Command, CommandEmpty, CommandInput, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SEARCH_MIN_LENGTH, useLatest, usePriceSearch, type PriceScope } from '@/lib/api/prices';
import { GAME, useEconomyContext } from '@/lib/economy/use-economy-context';
import { useDebouncedValue } from '@/lib/use-debounced';
import { useWatchlist } from '@/lib/api/watchlist';
import { toRecentlyAdded } from '@/lib/watchlist/recent';
import { GoTo, ItemResults } from './PaletteResults';

/** Opens and closes the palette on Cmd+K and on Ctrl+K. */
export function useCommandShortcut(toggle: () => void) {
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;

            event.preventDefault();
            toggle();
        }

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [toggle]);
}

const SEARCH_DEBOUNCE_MS = 200;

const RECENT_WATCHED = 5;

/** What the palette lists for what was typed: the name matches with their prices, the watched ones set apart, and where to jump. */
function usePaletteResults(needle: string, scope: PriceScope) {
    const debounced = useDebouncedValue(needle, SEARCH_DEBOUNCE_MS);
    const search = usePriceSearch(GAME, debounced);
    const watchlist = useWatchlist();
    const found = debounced.length >= SEARCH_MIN_LENGTH ? (search.data?.results ?? []) : [];
    const latest = useLatest(
        scope,
        found.map((match) => match.item.id),
    );
    const prices = new Map(latest.data?.rows.map((row) => [row.item.id, row]));

    for (const row of watchlist.rows) prices.set(row.item.id, row);

    // With a query the watched results are lifted out of the best matches; with none, the newest additions stand in.
    const watched = needle ? found.filter((match) => watchlist.isWatched(match.item.id)) : toRecentlyAdded(watchlist.rows, watchlist.unlisted, RECENT_WATCHED);
    const matches = found.filter((match) => !watchlist.isWatched(match.item.id));
    const lowered = needle.toLowerCase();
    const categories = CATEGORIES[GAME].filter((category) => category.label.toLowerCase().includes(lowered));
    const offersWatchlist = watchlist.answer !== undefined && 'watchlist'.includes(lowered);
    const searching = needle.length >= SEARCH_MIN_LENGTH && (needle !== debounced || search.isFetching);

    return { matches, watched, prices, categories, searching, watchlistCount: offersWatchlist ? watchlist.count : undefined };
}

/**
 * The search palette: a debounced name search, then one call for the matches' prices in the current league and unit,
 * and the categories to jump to. The list is the API's ranking, so cmdk's own filtering is off.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const [text, setText] = useState('');
    const { scope } = useEconomyContext();
    const navigate = useNavigate();
    const needle = text.trim();
    const { matches, watched, prices, categories, searching, watchlistCount } = usePaletteResults(needle, scope);
    const hasResults = matches.length > 0 || watched.length > 0;

    function close(next: boolean) {
        onOpenChange(next);

        if (!next) setText('');
    }

    function openItem(itemId: number) {
        close(false);
        void navigate({ to: '/items/$itemId', params: { itemId: String(itemId) } });
    }

    function openWatchlist() {
        close(false);
        void navigate({ to: '/watchlist' });
    }

    function openCategory(category: string) {
        close(false);
        void navigate({ to: '/economy/$category', params: { category } });
    }

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent
                showCloseButton={false}
                className="bg-card top-[110px] w-[min(680px,calc(100%-32px))] max-w-none translate-y-0 gap-0 rounded-2xl p-0 sm:max-w-none"
            >
                <DialogTitle className="sr-only">Search</DialogTitle>
                <DialogDescription className="sr-only">Search every currency and item</DialogDescription>
                <Command shouldFilter={false} loop>
                    <CommandInput value={text} onValueChange={setText} placeholder="Search every currency and item" />
                    <CommandList>
                        {matches.length > 0 && <ItemResults heading="Best matches" matches={matches} prices={prices} onOpen={openItem} />}
                        {watched.length > 0 && <ItemResults heading="On your watchlist" matches={watched} prices={prices} onOpen={openItem} />}
                        {(categories.length > 0 || watchlistCount !== undefined) && (
                            <GoTo categories={categories} watchlistCount={watchlistCount} onOpenCategory={openCategory} onOpenWatchlist={openWatchlist} />
                        )}
                        {!hasResults && categories.length === 0 && watchlistCount === undefined && !searching && (
                            <CommandEmpty>Nothing matches “{needle}”.</CommandEmpty>
                        )}
                        {!hasResults && searching && (
                            <p role="status" className="text-muted-foreground py-6 text-center text-sm">
                                Searching…
                            </p>
                        )}
                    </CommandList>
                    <div className="text-muted-foreground flex items-center justify-between gap-2 border-t px-5 py-3 text-xs">
                        <span>↑↓ to move · Enter to open</span>
                        <span className="flex items-center gap-2">
                            Close <kbd className="border-input rounded-md border px-1.5 py-0.5 font-sans">Esc</kbd>
                        </span>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
