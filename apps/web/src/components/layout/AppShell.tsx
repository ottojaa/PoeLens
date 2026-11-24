import { useCallback, useState, type ReactNode } from 'react';
import { CommandPalette, useCommandShortcut } from './CommandPalette';
import { Footer } from './Footer';
import { Header } from './Header';
import { BreadcrumbProvider } from './HeaderBreadcrumb';
import { Sidebar, SidebarDrawer } from './Sidebar';

/** The signed-in frame: header, sidebar (a drawer on phones), the page, and the footer. */
export function AppShell({ children }: { children: ReactNode }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    useCommandShortcut(useCallback(() => setSearchOpen((open) => !open), []));

    return (
        <BreadcrumbProvider>
            <div className="flex min-h-screen flex-col">
                <Header onOpenMenu={() => setMenuOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
                <div className="flex flex-1">
                    <Sidebar />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <main className="w-full flex-1 px-4 py-7 md:px-8">{children}</main>
                        <Footer />
                    </div>
                </div>
                <SidebarDrawer open={menuOpen} onOpenChange={setMenuOpen} />
                <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
            </div>
        </BreadcrumbProvider>
    );
}
