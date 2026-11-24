import { Link } from '@tanstack/react-router';
import { Menu, Search } from 'lucide-react';
import { Wordmark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { useEconomyContext } from '@/lib/economy/use-economy-context';
import { AccountMenu } from './AccountMenu';
import { BreadcrumbSlot } from './HeaderBreadcrumb';
import { LeagueSwitcher } from './LeagueSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { UnitToggle } from './UnitToggle';

export function Header({ onOpenMenu, onOpenSearch }: { onOpenMenu: () => void; onOpenSearch: () => void }) {
    const { scope, leagues, league, setLeague, setUnit } = useEconomyContext();

    return (
        <header className="bg-card sticky top-0 z-30 min-h-(--header-height) flex flex-wrap items-center md:flex-nowrap gap-x-2 gap-y-2 border-b px-3 py-3 sm:gap-x-4 sm:px-4 md:px-6">
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={onOpenMenu}>
                <Menu />
            </Button>
            <Link to="/" aria-label="PoeLens home" className="focus-visible:ring-ring/50 mr-2 rounded-md outline-none focus-visible:ring-[3px]">
                <Wordmark className="max-sm:[&>span]:hidden" />
            </Link>
            <BreadcrumbSlot />
            <div className="hidden md:block">
                <LeagueSwitcher leagues={leagues ?? []} value={league?.name ?? null} onChange={setLeague} />
            </div>
            <Button
                type="button"
                variant="outline"
                onClick={onOpenSearch}
                className="bg-card text-muted-foreground ml-auto h-10 min-w-0 justify-start gap-2.5 rounded-[10px] px-3.5 font-normal md:ml-0 md:max-w-[520px] md:flex-1"
            >
                <Search className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden flex-1 truncate text-left lg:inline">Search every currency and item</span>
                <span className="sr-only md:not-sr-only md:flex-1 md:truncate md:text-left lg:sr-only">Search</span>
                <kbd className="border-input hidden rounded-md border px-1.5 py-0.5 font-sans text-xs sm:inline md:hidden lg:inline">⌘K</kbd>
            </Button>
            <div className="flex shrink-0 items-center gap-2 md:ml-auto">
                <UnitToggle value={scope.unit} onChange={setUnit} />
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <ThemeToggle className="max-sm:hidden" />
                <AccountMenu />
            </div>
        </header>
    );
}
