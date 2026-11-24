import { CATEGORIES, type Block, type ItemRef, type Unit } from '@poelens/shared';
import { ArrowLeft, ArrowLeftRight, Coins, Filter, Heading, LineChart, Plus, Search, StickyNote, Table2, TrendingUp, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SEARCH_MIN_LENGTH, usePriceSearch, useCurrencyRows, type PriceScope } from '@/lib/api/prices';
import {
    newChartBlock,
    newHeadingBlock,
    newItemBlock,
    newMoversBlock,
    newNoteBlock,
    newPairBlock,
    newScreenerBlock,
    newTableBlock,
} from '@/lib/dashboard/editor';
import { GAME } from '@/lib/economy/use-economy-context';
import { UNIT_LABEL } from '@/lib/economy/units';
import { useDebouncedValue } from '@/lib/use-debounced';
import { ItemIcon } from '@/components/economy/ItemIcon';

/** The currency item each unit is counted in, found by name among the Currency rows. */
const UNIT_ITEM_NAME: Record<Unit, string> = { divine: 'Divine Orb', exalted: 'Exalted Orb', chaos: 'Chaos Orb' };

/** The block types an item is searched for first: the rest need no item to start with. */
type SearchKind = 'item' | 'pair' | 'chart';

interface BlockTypeEntry {
    id: string;
    label: string;
    description: string;
    icon: LucideIcon;
    /** Set for the types that begin with an item: choosing one opens the search. */
    search?: SearchKind;
    create?: () => Block;
}

const BLOCK_TYPES: readonly BlockTypeEntry[] = [
    { id: 'item', label: 'Item', description: 'One item: price, change, sparkline', icon: Coins, search: 'item' },
    { id: 'pair', label: 'Pair', description: 'Item A priced in item B', icon: ArrowLeftRight, search: 'pair' },
    { id: 'note', label: 'Note', description: 'Markdown text and links', icon: StickyNote, create: newNoteBlock },
    { id: 'heading', label: 'Heading or divider', description: 'Splits a panel into sections', icon: Heading, create: newHeadingBlock },
    {
        id: 'table',
        label: 'Price table',
        description: 'A category, filtered and sorted',
        icon: Table2,
        create: () => newTableBlock(CATEGORIES[GAME][0]?.id ?? 'Currency'),
    },
    { id: 'movers', label: 'Movers', description: 'Risers and fallers in a group', icon: TrendingUp, create: newMoversBlock },
    { id: 'screener', label: 'Screener', description: 'Items that match a rule you set', icon: Filter, create: newScreenerBlock },
    { id: 'chart', label: 'Price chart', description: "One item's price history", icon: LineChart, search: 'chart' },
];

function useUnitItemId(scope: PriceScope, unit: Unit): number | undefined {
    const rows = useCurrencyRows(scope).data?.rows;

    return rows?.find((row) => row.item.name === UNIT_ITEM_NAME[unit])?.item.id;
}

function SearchResults({
    text,
    kind,
    unit,
    unitItemId,
    onAdd,
}: {
    text: string;
    kind: SearchKind;
    unit: Unit;
    unitItemId: number | undefined;
    onAdd: (block: Block) => void;
}) {
    const search = usePriceSearch(GAME, text);
    const results = search.data?.results ?? [];

    if (text.length < SEARCH_MIN_LENGTH) return <p className="text-muted-foreground px-1 text-sm">Type at least {SEARCH_MIN_LENGTH} letters.</p>;

    if (search.isError) return <p className="text-destructive px-1 text-sm">Search failed. Try again.</p>;

    if (search.data && results.length === 0) return <p className="text-muted-foreground px-1 text-sm">No item matches “{text}”.</p>;

    return (
        <ul className="flex flex-col gap-0.5">
            {results.map(({ item }) => (
                <ResultRow key={item.id} item={item} kind={kind} unit={unit} unitItemId={unitItemId} onAdd={onAdd} />
            ))}
        </ul>
    );
}

/** What choosing an item makes of it: an item block, a pair priced in the unit, or a chart. A pair of a unit with itself is not offered. */
function toBlock(kind: SearchKind, item: ItemRef, unitItemId: number | undefined): Block | undefined {
    if (kind === 'item') return newItemBlock(item.id);

    if (kind === 'chart') return newChartBlock(item.id);

    return unitItemId !== undefined && unitItemId !== item.id ? newPairBlock(item.id, unitItemId) : undefined;
}

function ResultRow({
    item,
    kind,
    unit,
    unitItemId,
    onAdd,
}: {
    item: ItemRef;
    kind: SearchKind;
    unit: Unit;
    unitItemId: number | undefined;
    onAdd: (block: Block) => void;
}) {
    const block = toBlock(kind, item, unitItemId);
    const verb = kind === 'pair' ? 'Pair in ' + UNIT_LABEL[unit] : kind === 'chart' ? 'Chart' : 'Item';

    return (
        <li className="hover:bg-accent flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <ItemIcon item={item} size="xs" />
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{item.name}</span>
                <span className="text-muted-foreground truncate text-xs">{item.baseType ?? item.category}</span>
            </span>
            {block && (
                <Button type="button" variant="outline" size="sm" onClick={() => onAdd(block)} aria-label={'Add ' + item.name + ' as ' + verb.toLowerCase()}>
                    + {verb}
                </Button>
            )}
        </li>
    );
}

function TypeList({ onPick }: { onPick: (entry: BlockTypeEntry) => void }) {
    return (
        <ul className="flex flex-col gap-0.5">
            {BLOCK_TYPES.map((entry) => (
                <li key={entry.id}>
                    <Button type="button" variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2 text-left" onClick={() => onPick(entry)}>
                        <span className="bg-secondary text-primary grid size-8 shrink-0 place-items-center rounded-lg">
                            <entry.icon aria-hidden="true" className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-semibold">{entry.label}</span>
                            <span className="text-muted-foreground text-xs font-normal">{entry.description}</span>
                        </span>
                    </Button>
                </li>
            ))}
        </ul>
    );
}

/**
 * "Add block": the types of block with what each shows. An item, a pair or a chart starts with a search for its item
 * (a pair is priced in `unit`: the panel's, else the page's); the others are added with their defaults.
 */
export function AddBlockMenu({ scope, unit, disabled, onAdd }: { scope: PriceScope; unit: Unit; disabled: boolean; onAdd: (block: Block) => void }) {
    const [open, setOpen] = useState(false);
    const [kind, setKind] = useState<SearchKind | undefined>(undefined);
    const [text, setText] = useState('');
    const debounced = useDebouncedValue(text.trim(), 200);
    const unitItemId = useUnitItemId(scope, unit);

    const close = (next: boolean) => {
        setOpen(next);

        if (!next) {
            setKind(undefined);
            setText('');
        }
    };

    const add = (block: Block) => {
        onAdd(block);
        close(false);
    };

    const pick = (entry: BlockTypeEntry) => {
        if (entry.search) return setKind(entry.search);

        if (entry.create) add(entry.create());
    };

    return (
        <Popover open={open} onOpenChange={close}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={disabled} className="gap-1.5">
                    <Plus aria-hidden="true" className="text-primary" />
                    Add block
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
                {kind === undefined ? (
                    <TypeList onPick={pick} />
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0"
                                aria-label="Back to block types"
                                onClick={() => setKind(undefined)}
                            >
                                <ArrowLeft aria-hidden="true" />
                            </Button>
                            <div className="relative flex-1">
                                <Search aria-hidden="true" className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                <Input
                                    autoFocus
                                    aria-label="Search an item"
                                    placeholder="Search an item"
                                    value={text}
                                    onChange={(event) => setText(event.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <SearchResults text={debounced} kind={kind} unit={unit} unitItemId={unitItemId} onAdd={add} />
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}
