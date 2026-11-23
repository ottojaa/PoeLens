import { createFileRoute } from '@tanstack/react-router';
import { HealthCard } from '@/components/health/HealthCard';

export const Route = createFileRoute('/')({
    component: HomePage,
});

function HomePage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">PoeLens</h1>
                <p className="text-muted-foreground">Path of Exile prices, history and your watchlist, in one place.</p>
            </div>
            <HealthCard />
        </div>
    );
}
