import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { AuthGate, isPublicPath } from '@/components/auth/AuthGate';
import { AppShell } from '@/components/layout/AppShell';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useAuth } from '@/lib/auth';
import { PageTransition } from '@/motion/PageTransition';

export const Route = createRootRoute({
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
        <Frame>
            <AuthGate>
                <PageTransition>
                    <Outlet />
                </PageTransition>
            </AuthGate>
        </Frame>
    );
}
