import { Link, useNavigate } from '@tanstack/react-router';
import { LogOut, Moon, Shield, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

/** The signed-in user's menu: their name, the admin page for admins, the theme switch where the header has no room for it, and sign out. */
export function AccountMenu() {
    const { state, signOut } = useAuth();
    const navigate = useNavigate();
    const { isDark, setIsDark } = useTheme();

    if (state.status !== 'signedIn') return null;

    const { user } = state;

    async function onSignOut() {
        await signOut();
        await navigate({ to: '/login' });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label="Account" className="bg-secondary size-10 rounded-full p-0 font-semibold uppercase">
                    {user.displayName.slice(0, 1)}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuLabel className="truncate">{user.displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === 'admin' && (
                    <DropdownMenuItem asChild>
                        <Link to="/admin">
                            <Shield /> Admin
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem className="sm:hidden" onSelect={() => setIsDark((prev) => !prev)}>
                    {isDark ? <Sun /> : <Moon />} {isDark ? 'Light theme' : 'Dark theme'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void onSignOut()}>
                    <LogOut /> Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
