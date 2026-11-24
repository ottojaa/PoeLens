import { createRootRoute, Outlet, retainSearchParams, useRouterState } from '@tanstack/react-router';
import { AuthGate, isPublicPath } from '@/components/auth/AuthGate';
import { AppShell } from '@/components/layout/AppShell';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/lib/auth';
import { parseRootSearch } from '@/lib/economy/search-params';
import { PageTransition } from '@/motion/PageTransition';

/**
 * League and unit belong to the whole app, so the root route owns them. `retainSearchParams` puts them back on every
 * navigation that does not name them, so a link to another page keeps the viewer's league and unit.
 */
export const Route = createRootRoute({
    validateSearch: parseRootSearch,
    search: { middlewares: [retainSearchParams(['league', 'unit'])] },
    component: RootLayout,
});

/**
 * Signed-in pages get the app shell. The sign-in, invite and reset pages get the bare layout, and so does everything
 * while the session loads or the visitor is signed out (the gate sends them to sign in), so the shell never flashes.
 */
function RootLayout() {
    const { state } = useAuth();
    const pathname = useRouterState({ select: (router) => router.location.pathname });
    const Frame = state.status === 'signedIn' && !isPublicPath(pathname) ? AppShell : PublicLayout;

    return (
        <>
            <Frame>
                <AuthGate>
                    <PageTransition>
                        <Outlet />
                    </PageTransition>
                </AuthGate>
            </Frame>
            <Toaster />
        </>
    );
}
