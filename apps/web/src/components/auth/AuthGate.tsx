import { Navigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

/** Pages a signed-out visitor may open: the sign-in page, and the pages behind an invite link and a reset link. */
export function isPublicPath(pathname: string): boolean {
    return pathname === '/login' || pathname.startsWith('/invite/') || pathname.startsWith('/reset/');
}

/**
 * Sends signed-out visitors to the sign-in page, and signed-in ones away from it. Waits for the session to be restored
 * first, so a reload does not flash the sign-in page.
 */
export function AuthGate({ children }: { children: ReactNode }) {
    const { state } = useAuth();
    const pathname = useRouterState({ select: (router) => router.location.pathname });

    if (state.status === 'loading') {
        return (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading your session">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 w-full max-w-md" />
            </div>
        );
    }

    if (state.status === 'signedOut' && !isPublicPath(pathname)) return <Navigate to="/login" replace />;

    if (state.status === 'signedIn' && pathname === '/login') return <Navigate to="/" replace />;

    return children;
}
