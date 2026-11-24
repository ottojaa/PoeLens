import type { Block, ItemRef, Unit } from '@poelens/shared';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SEARCH_MIN_LENGTH, usePriceSearch, useCurrencyRows, type PriceScope } from '@/lib/api/prices';
import { newHeadingBlock, newItemBlock, newNoteBlock, newPairBlock } from '@/lib/dashboard/editor';
import { GAME } from '@/lib/economy/use-economy-context';
import { UNIT_LABEL } from '@/lib/economy/units';
import { useDebouncedValue } from '@/lib/use-debounced';
import { ItemIcon } from '@/components/economy/ItemIcon';

/** The currency item each unit is counted in, found by name among the Currency rows. */
const UNIT_ITEM_NAME: Record<Unit, string> = { divine: 'Divine Orb', exalted: 'Exalted Orb', chaos: 'Chaos Orb' };

function useUnitItemId(scope: PriceScope, unit: Unit): number | undefined {
    const rows = useCurrencyRows(scope).data?.rows;

    return rows?.find((row) => row.item.name === UNIT_ITEM_NAME[unit])?.item.id;
}

function SearchResults({ text, unit, unitItemId, onAdd }: { text: string; unit: Unit; unitItemId: number | undefined; onAdd: (block: Block) => void }) {
    const search = usePriceSearch(GAME, text);
    const results = search.data?.results ?? [];

    if (text.length < SEARCH_MIN_LENGTH) return <p className="text-muted-foreground px-1 text-sm">Type at least {SEARCH_MIN_LENGTH} letters.</p>;

    if (search.isError) return <p className="text-destructive px-1 text-sm">Search failed. Try again.</p>;

    if (search.data && results.length === 0) return <p className="text-muted-foreground px-1 text-sm">No item matches “{text}”.</p>;

    return (
        <ul className="flex flex-col gap-0.5">
            {results.map(({ item }) => (
                <ResultRow key={item.id} item={item} unit={unit} unitItemId={unitItemId} onAdd={onAdd} />
            ))}
        </ul>
    );
}

function ResultRow({ item, unit, unitItemId, onAdd }: { item: ItemRef; unit: Unit; unitItemId: number | undefined; onAdd: (block: Block) => void }) {
    const canPair = unitItemId !== undefined && unitItemId !== item.id;

    return (
        <li className="hover:bg-accent flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <ItemIcon item={item} size="xs" />
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{item.name}</span>
                <span className="text-muted-foreground truncate text-xs">{item.baseType ?? item.category}</span>
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => onAdd(newItemBlock(item.id))} aria-label={'Add ' + item.name + ' as an item'}>
                + Item
            </Button>
            {canPair && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAdd(newPairBlock(item.id, unitItemId))}
                    aria-label={'Add ' + item.name + ' priced in ' + UNIT_LABEL[unit]}
                >
                    + Pair in {UNIT_LABEL[unit]}
                </Button>
            )}
        </li>
    );
}

/**
 * "Add block": search an item to add it as an item block or priced in a unit as a pair, or add a note or a heading.
 * `unit` is the unit the pair is priced in: the panel's, else the page's.
 */
export function AddBlockMenu({ scope, unit, disabled, onAdd }: { scope: PriceScope; unit: Unit; disabled: boolean; onAdd: (block: Block) => void }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const debounced = useDebouncedValue(text.trim(), 200);
    const unitItemId = useUnitItemId(scope, unit);

    const add = (block: Block) => {
        onAdd(block);
        setOpen(false);
        setText('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={disabled} className="gap-1.5">
                    <Plus aria-hidden="true" className="text-primary" />
                    Add block
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex w-[min(540px,calc(100vw-2rem))] flex-col gap-2">
                <div className="relative">
                    <Search aria-hidden="true" className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        aria-label="Search an item"
                        placeholder="Search an item"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        className="pl-9"
                    />
                </div>
                <SearchResults text={debounced} unit={unit} unitItemId={unitItemId} onAdd={add} />
                <p className="text-muted-foreground px-1 pt-1 text-[11px] font-semibold tracking-[0.08em] uppercase">Block types</p>
                <div className="grid grid-cols-2 gap-0.5">
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-auto flex-col items-start gap-0.5 px-2 py-2 text-left"
                        onClick={() => add(newNoteBlock())}
                    >
                        <span className="text-sm font-semibold">Note</span>
                        <span className="text-muted-foreground text-xs font-normal">Markdown text and links</span>
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-auto flex-col items-start gap-0.5 px-2 py-2 text-left"
                        onClick={() => add(newHeadingBlock())}
                    >
                        <span className="text-sm font-semibold">Heading or divider</span>
                        <span className="text-muted-foreground text-xs font-normal">Splits a panel into sections</span>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
