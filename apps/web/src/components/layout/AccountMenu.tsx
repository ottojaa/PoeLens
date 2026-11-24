import { Link, useNavigate } from '@tanstack/react-router';
import { LogOut, Moon, Palette, Shield, Sun } from 'lucide-react';
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

/** The signed-in user's menu: their name, the admin page for admins, the appearance page, the light/dark switch where the header has no room for it, and sign out. */
export function AccountMenu() {
    const { state, signOut } = useAuth();
    const navigate = useNavigate();
    const { isDark, toggleDark } = useTheme();

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
                <DropdownMenuItem asChild>
                    <Link to="/settings/appearance">
                        <Palette /> Appearance…
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="sm:hidden" onSelect={toggleDark}>
                    {isDark ? <Sun /> : <Moon />} {isDark ? 'Light mode' : 'Dark mode'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void onSignOut()}>
                    <LogOut /> Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
