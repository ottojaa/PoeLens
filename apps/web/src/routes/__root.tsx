import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AuthGate } from '@/components/auth/AuthGate';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';

export const Route = createRootRoute({
    component: RootLayout,
});

function RootLayout() {
    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
                <AuthGate>
                    <Outlet />
                </AuthGate>
            </main>
            <Footer />
        </div>
    );
}
