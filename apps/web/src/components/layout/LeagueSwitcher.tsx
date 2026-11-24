import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Soon } from './Soon';

export interface LeagueOption {
    name: string;
    hardcore: boolean;
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
            <Button
                type="button"
                variant="outline"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-label={selected ? `League: ${selected.name}` : 'League'}
                onClick={() => onChange(value ?? '')}
                className="bg-card h-10 rounded-full px-3.5 font-normal disabled:opacity-60"
            >
                <span className="bg-primary size-2 rounded-full" aria-hidden="true" />
                {selected ? selected.name : 'League'}
                {selected && <span className="text-muted-foreground">· {selected.hardcore ? 'Hardcore' : 'Softcore'}</span>}
                <ChevronDown className="text-muted-foreground size-3.5" aria-hidden="true" />
            </Button>
            {disabled && <Soon />}
        </div>
    );
}
