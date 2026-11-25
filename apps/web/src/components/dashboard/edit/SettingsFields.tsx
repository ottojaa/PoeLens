import { CATEGORIES, SCOPE_GROUPS, type Scope } from '@poelens/shared';
import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { GAME } from '@/lib/economy/use-economy-context';

/** A labelled setting: the label names it and `hint` says what it does. */
export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={htmlFor} className="text-sm font-semibold">
                {label}
            </label>
            {children}
            {hint && <span className="text-muted-foreground text-xs leading-snug">{hint}</span>}
        </div>
    );
}

/** A pick of one from a list, as a menu: there are too many categories for a row of buttons. */
export function ChoiceMenu<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: readonly { value: T; label: string }[];
    onChange: (value: T) => void;
}) {
    const current = options.find((option) => option.value === value)?.label ?? value;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" aria-label={label + ': ' + current} className="justify-between font-normal">
                    <span className="truncate">{current}</span>
                    <ChevronDown aria-hidden="true" className="text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(options.find((option) => option.value === next)?.value ?? value)}>
                    {options.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * A number the user types. A half-typed or out-of-range entry waits in the field and is never saved; leaving the field
 * puts the saved number back. `nullable` makes an empty field mean "no value".
 */
export function NumberField({
    id,
    value,
    min,
    max,
    step,
    nullable,
    onChange,
}: {
    id: string;
    value: number | null;
    min: number;
    max: number;
    step?: number;
    nullable?: boolean;
    onChange: (value: number | null) => void;
}) {
    const [text, setText] = useState<string | undefined>(undefined);

    const edit = (next: string) => {
        setText(next);

        if (next.trim() === '') return nullable ? onChange(null) : undefined;

        const parsed = Number(next);

        if (Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed);
    };

    return (
        <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step ?? 1}
            value={text ?? (value === null ? '' : String(value))}
            onChange={(event) => edit(event.target.value)}
            onBlur={() => setText(undefined)}
        />
    );
}

const GROUP_CHOICES = [
    ...SCOPE_GROUPS.map((group) => ({ value: group, label: group === 'all' ? 'All' : group === 'economy' ? 'Economy' : 'Uniques' })),
    { value: 'pick', label: 'Pick…' },
] as const;

/** Which categories a block looks over: a group, or a list picked by hand. A list always keeps at least one category. */
export function ScopeField({ scope, onChange }: { scope: Scope; onChange: (scope: Scope) => void }) {
    const picked = 'categories' in scope ? scope.categories : [];

    const toggle = (id: string, on: boolean) => {
        const next = on ? [...picked, id] : picked.filter((candidate) => candidate !== id);

        if (next.length > 0) onChange({ categories: next });
    };

    return (
        <div className="flex flex-col gap-1.5">
            <Segmented
                label="Look in"
                value={'group' in scope ? scope.group : 'pick'}
                options={GROUP_CHOICES}
                onChange={(next) => onChange(next === 'pick' ? { categories: [CATEGORIES[GAME][0]?.id ?? 'Currency'] } : { group: next })}
                className="[&_button]:px-1.5 [&_button]:text-xs"
            />
            {'categories' in scope && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" className="justify-between font-normal">
                            <span className="truncate">
                                {picked.length} of {CATEGORIES[GAME].length} categories
                            </span>
                            <ChevronDown aria-hidden="true" className="text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                        {CATEGORIES[GAME].map((category) => (
                            <DropdownMenuCheckboxItem
                                key={category.id}
                                checked={picked.includes(category.id)}
                                onSelect={(event) => event.preventDefault()}
                                onCheckedChange={(on) => toggle(category.id, on)}
                            >
                                {category.label}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
