import { Columns3, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { COLUMN_LABELS, OPTIONAL_COLUMNS, type OptionalColumn } from '@/lib/economy/columns';
import type { EconomyView } from '@/lib/economy/search-params';
import { useUrlBackedText } from '@/lib/use-debounced';

export interface ViewChange {
    q?: string;
    min?: number;
    columns?: readonly OptionalColumn[];
}

function ColumnMenu({ columns, onChange }: { columns: readonly OptionalColumn[]; onChange: (columns: readonly OptionalColumn[]) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-10 gap-2 font-normal">
                    <Columns3 className="size-4" aria-hidden="true" />
                    Columns
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {OPTIONAL_COLUMNS.map((column) => (
                    <DropdownMenuCheckboxItem
                        key={column}
                        checked={columns.includes(column)}
                        // Keep the menu open: several columns are usually changed together.
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) =>
                            onChange(OPTIONAL_COLUMNS.filter((candidate) => (candidate === column ? checked : columns.includes(candidate))))
                        }
                    >
                        {COLUMN_LABELS[column]}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** The filter field, the minimum-liquidity field and the column menu above the table. */
export function EconomyToolbar({ view, liquidityLabel, onChange }: { view: EconomyView; liquidityLabel: string; onChange: (change: ViewChange) => void }) {
    const [text, setText] = useUrlBackedText(view.q, (value) => onChange({ q: value.trim() }));
    const [min, setMin] = useUrlBackedText(view.min ? String(view.min) : '', (value) => onChange({ min: Number(value) || 0 }));

    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-52 flex-1 md:max-w-sm">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
                <Input
                    type="search"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Filter this category"
                    aria-label="Filter this category"
                    className="h-10 pl-9"
                />
            </div>
            <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={min}
                onChange={(event) => setMin(event.target.value)}
                placeholder={`Min. ${liquidityLabel.toLowerCase()}`}
                aria-label={`Minimum ${liquidityLabel.toLowerCase()}`}
                className="h-10 w-40"
            />
            <div className="ml-auto">
                <ColumnMenu columns={view.columns} onChange={(columns) => onChange({ columns })} />
            </div>
        </div>
    );
}
