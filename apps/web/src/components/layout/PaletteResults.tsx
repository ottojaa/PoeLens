import type { Category, PriceRow, SearchResponse } from '@poelens/shared';
import { Change } from '@/components/economy/Change';
import { ItemIcon } from '@/components/economy/ItemIcon';
import { CommandGroup, CommandItem } from '@/components/ui/command';
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

/** The search matches in the API's order, each with its price and 7-day change once those have loaded. */
export function BestMatches({
    matches,
    prices,
    onOpen,
}: {
    matches: SearchResponse['results'];
    prices: ReadonlyMap<number, PriceRow>;
    onOpen: (itemId: number) => void;
}) {
    return (
        <CommandGroup heading="Best matches">
            {matches.map(({ item }) => {
                const row = prices.get(item.id);

                return (
                    <CommandItem key={item.id} value={String(item.id)} onSelect={() => onOpen(item.id)} className="gap-3">
                        <ItemIcon item={item} />
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-semibold">{item.name}</span>
                            <span className="text-muted-foreground truncate text-xs">{item.baseType ?? item.category}</span>
                        </span>
                        {row && <PriceAndChange row={row} />}
                    </CommandItem>
                );
            })}
        </CommandGroup>
    );
}

/** The categories whose names match, to jump to. */
export function GoToCategories({ categories, onOpen }: { categories: readonly Category[]; onOpen: (categoryId: string) => void }) {
    return (
        <CommandGroup heading="Go to">
            {categories.map((category) => (
                <CommandItem key={category.id} value={'category:' + category.id} onSelect={() => onOpen(category.id)}>
                    {category.label}
                </CommandItem>
            ))}
        </CommandGroup>
    );
}
