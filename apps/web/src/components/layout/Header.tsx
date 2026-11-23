import { Link } from '@tanstack/react-router';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
    return (
        <header className="border-b bg-background/80 sticky top-0 z-10 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
                <Link
                    to="/"
                    className="flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                    <img src="/favicon.svg" alt="" className="size-6" />
                    PoeLens
                </Link>
                <ThemeToggle />
            </div>
        </header>
    );
}
