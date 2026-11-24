import type { Category, ItemRef, PriceRow } from '@poelens/shared';
import { Change } from '@/components/economy/Change';
import { ItemIcon } from '@/components/economy/ItemIcon';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { StarIcon } from '@/components/watchlist/WatchStar';
import { toCategoryLabel } from '@/lib/economy/category-label';
import { GAME } from '@/lib/economy/use-economy-context';
import { UNIT_SHORT } from '@/lib/economy/units';
import { formatPrice } from '@/lib/format';

function PriceAndChange({ row }: { row: PriceRow }) {
    return (
        <span className="flex shrink-0 items-baseline gap-3 text-sm">
            <span className="font-semibold">
                {formatPrice(row.price)} <span className="text-muted-foreground font-medium">{UNIT_SHORT[row.unit]}</span>
            </span>
            <Change percent={row.change.d7} />
        </span>
    );
}

/** Items in the order given, each with its price and 7-day change once those are known. */
export function ItemResults({
    heading,
    matches,
    prices,
    onOpen,
}: {
    heading: string;
    matches: readonly { item: ItemRef }[];
    prices: ReadonlyMap<number, PriceRow>;
    onOpen: (itemId: number) => void;
}) {
    return (
        <CommandGroup heading={heading}>
            {matches.map(({ item }) => {
                const row = prices.get(item.id);

                return (
                    <CommandItem key={item.id} value={String(item.id)} onSelect={() => onOpen(item.id)} className="gap-3">
                        <ItemIcon item={item} />
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-semibold">{item.name}</span>
                            <span className="text-muted-foreground truncate text-xs">{item.baseType ?? toCategoryLabel(GAME, item.category)}</span>
                        </span>
                        {row && <PriceAndChange row={row} />}
                    </CommandItem>
                );
            })}
        </CommandGroup>
    );
}

/** Where to jump to: the watchlist (when offered) and the categories whose names match. */
export function GoTo({
    categories,
    watchlistCount,
    onOpenCategory,
    onOpenWatchlist,
}: {
    categories: readonly Category[];
    /** The watchlist's size, or undefined to leave the entry out. */
    watchlistCount: number | undefined;
    onOpenCategory: (categoryId: string) => void;
    onOpenWatchlist: () => void;
}) {
    return (
        <CommandGroup heading="Go to">
            {watchlistCount !== undefined && (
                <CommandItem value="watchlist" onSelect={onOpenWatchlist} className="gap-3.5">
                    <StarIcon filled={false} size={20} strokeWidth={1.8} className="text-muted-foreground mx-2 size-5 shrink-0" />
                    <span className="flex-1">Watchlist</span>
                    <span className="text-muted-foreground text-xs">{watchlistCount === 1 ? '1 item' : `${watchlistCount} items`}</span>
                </CommandItem>
            )}
            {categories.map((category) => (
                <CommandItem key={category.id} value={'category:' + category.id} onSelect={() => onOpenCategory(category.id)}>
                    {category.label}
                </CommandItem>
            ))}
        </CommandGroup>
    );
}
