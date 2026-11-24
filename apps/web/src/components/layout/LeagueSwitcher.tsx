import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Soon } from './Soon';

export interface LeagueOption {
    name: string;
    hardcore: boolean;
}

function toModeLabel(league: LeagueOption) {
    return league.hardcore ? 'Hardcore' : 'Softcore';
}

/** Picks the league the page shows prices for. Controlled: the economy view will own the value and the list. */
export function LeagueSwitcher({
    leagues,
    value,
    onChange,
    disabled = false,
}: {
    leagues: readonly LeagueOption[];
    value: string | null;
    onChange: (league: string) => void;
    disabled?: boolean;
}) {
    const selected = leagues.find((league) => league.name === value);

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={disabled || leagues.length === 0}
                        aria-label={selected ? `League: ${selected.name}` : 'League'}
                        className="bg-card h-10 rounded-full px-3.5 font-normal disabled:opacity-60"
                    >
                        <span className="bg-primary size-2 rounded-full" aria-hidden="true" />
                        {selected ? selected.name : 'League'}
                        {selected && <span className="text-muted-foreground">· {toModeLabel(selected)}</span>}
                        <ChevronDown className="text-muted-foreground size-3.5" aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-52">
                    <DropdownMenuRadioGroup value={value ?? ''} onValueChange={onChange}>
                        {leagues.map((league) => (
                            <DropdownMenuRadioItem key={league.name} value={league.name}>
                                {league.name} <span className="text-muted-foreground">· {toModeLabel(league)}</span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            {disabled && <Soon />}
        </div>
    );
}
