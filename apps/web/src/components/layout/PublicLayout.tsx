import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Wordmark } from '@/components/brand/Logo';
import { Footer } from './Footer';
import { ThemeToggle } from './ThemeToggle';

/** The frame for the pages a signed-out visitor sees: the wordmark, the theme toggle and the footer, nothing else. */
export function PublicLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col">
            <header className="flex items-center justify-between px-4 py-3 md:px-6">
                <Link to="/" aria-label="PoeLens home" className="focus-visible:ring-ring/50 rounded-md outline-none focus-visible:ring-[3px]">
                    <Wordmark />
                </Link>
                <ThemeToggle />
            </header>
            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">{children}</main>
            <Footer />
        </div>
    );
}
