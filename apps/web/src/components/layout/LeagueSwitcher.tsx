import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export interface LeagueOption {
    name: string;
    hardcore: boolean;
}

function toModeLabel(league: LeagueOption) {
    return league.hardcore ? 'Hardcore' : 'Softcore';
}

/** Picks the league the page shows prices for. Controlled: the value and the list come from the economy context. */
export function LeagueSwitcher({ leagues, value, onChange }: { leagues: readonly LeagueOption[]; value: string | null; onChange: (league: string) => void }) {
    const selected = leagues.find((league) => league.name === value);

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={leagues.length === 0}
                        aria-label={selected ? `League: ${selected.name}` : 'League'}
                        className="bg-card h-10 max-w-60 rounded-full px-3.5 font-normal disabled:opacity-60 lg:max-w-none"
                    >
                        <span className="bg-primary size-2 rounded-full" aria-hidden="true" />
                        <span className="truncate">{selected ? selected.name : 'League'}</span>
                        {selected && <span className="text-muted-foreground shrink-0">· {toModeLabel(selected)}</span>}
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
        </div>
    );
}
