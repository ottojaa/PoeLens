import { CATEGORIES } from '@poelens/shared';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Change } from '@/components/economy/Change';
import { ItemIcon } from '@/components/economy/ItemIcon';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

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

import { SEARCH_MIN_LENGTH, useLatest, usePriceSearch } from '@/lib/api/prices';
import { GAME, useEconomyContext } from '@/lib/economy/use-economy-context';
import { UNIT_SHORT } from '@/lib/economy/units';
import { formatPrice } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced';

const SEARCH_DEBOUNCE_MS = 200;
/** The API's cap on one `latest` call, and what a search shows. */
const MAX_RESULTS = 20;

/**
 * The search palette: a debounced name search, then one call for the matches' prices in the current league and unit,
 * and the categories to jump to. The list is the API's ranking, so cmdk's own filtering is off.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const [text, setText] = useState('');
    const { scope } = useEconomyContext();
    const navigate = useNavigate();
    const needle = text.trim();
    const debounced = useDebouncedValue(needle, SEARCH_DEBOUNCE_MS);
    const search = usePriceSearch(GAME, debounced);
    const matches = debounced.length >= SEARCH_MIN_LENGTH ? (search.data?.results.slice(0, MAX_RESULTS) ?? []) : [];
    const latest = useLatest(
        scope,
        matches.map((match) => match.item.id),
    );
    const priceOf = new Map(latest.data?.rows.map((row) => [row.item.id, row]));
    const categories = CATEGORIES[GAME].filter((category) => category.label.toLowerCase().includes(needle.toLowerCase()));
    const searching = needle.length >= SEARCH_MIN_LENGTH && (needle !== debounced || search.isFetching);

    function close(next: boolean) {
        onOpenChange(next);

        if (!next) setText('');
    }

    function openItem(itemId: number) {
        close(false);
        void navigate({ to: '/items/$itemId', params: { itemId: String(itemId) } });
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
                        {matches.length > 0 && (
                            <CommandGroup heading="Best matches">
                                {matches.map(({ item }) => {
                                    const row = priceOf.get(item.id);

                                    return (
                                        <CommandItem key={item.id} value={String(item.id)} onSelect={() => openItem(item.id)} className="gap-3">
                                            <ItemIcon item={item} />
                                            <span className="flex min-w-0 flex-1 flex-col">
                                                <span className="truncate font-semibold">{item.name}</span>
                                                <span className="text-muted-foreground truncate text-xs">{item.baseType ?? item.category}</span>
                                            </span>
                                            {row && (
                                                <span className="flex shrink-0 items-baseline gap-3 text-sm">
                                                    <span className="font-semibold">
                                                        {formatPrice(row.price)}{' '}
                                                        <span className="text-muted-foreground font-medium">{UNIT_SHORT[scope.unit]}</span>
                                                    </span>
                                                    <Change percent={row.change.d7} />
                                                </span>
                                            )}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        )}
                        {categories.length > 0 && (
                            <CommandGroup heading="Go to">
                                {categories.map((category) => (
                                    <CommandItem key={category.id} value={'category:' + category.id} onSelect={() => openCategory(category.id)}>
                                        {category.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                        {matches.length === 0 && categories.length === 0 && !searching && <CommandEmpty>Nothing matches “{needle}”.</CommandEmpty>}
                        {matches.length === 0 && searching && (
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
