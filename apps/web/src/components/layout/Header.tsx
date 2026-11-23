import { Link, useNavigate } from '@tanstack/react-router';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
    const { state, signOut } = useAuth();
    const navigate = useNavigate();
    const user = state.status === 'signedIn' ? state.user : null;

    async function onSignOut() {
        await signOut();
        await navigate({ to: '/login' });
    }

    return (
        <header className="border-b bg-background/80 sticky top-0 z-10 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
                <Link
                    to="/"
                    className="flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                    <img src="/favicon.svg" alt="" className="size-6" />
                    PoeLens
                </Link>
                <div className="flex items-center gap-1">
                    {user?.role === 'admin' && (
                        <Link to="/admin" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                            Admin
                        </Link>
                    )}
                    {user && (
                        <>
                            <span className="text-muted-foreground hidden max-w-40 truncate text-sm sm:inline">{user.displayName}</span>
                            <Button variant="ghost" size="sm" onClick={() => void onSignOut()}>
                                Sign out
                            </Button>
                        </>
                    )}
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
