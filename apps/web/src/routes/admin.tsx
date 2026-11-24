import { createFileRoute } from '@tanstack/react-router';
import { InvitesPanel } from '@/components/admin/InvitesPanel';
import { UsersPanel } from '@/components/admin/UsersPanel';
import { HealthCard } from '@/components/health/HealthCard';
import { useAuth } from '@/lib/auth';

export const Route = createFileRoute('/admin')({
    component: AdminPage,
});

function AdminPage() {
    const { state } = useAuth();

    // The API enforces this on every admin call; the page only avoids showing members a screen that cannot work.
    if (state.status !== 'signedIn' || state.user.role !== 'admin') {
        return <p className="text-muted-foreground">Only admins can open this page.</p>;
    }

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
            <HealthCard />
            <InvitesPanel />
            <UsersPanel />
        </div>
    );
}
