import { createFileRoute } from '@tanstack/react-router';
import { AppearancePage } from '@/components/settings/AppearancePage';

export const Route = createFileRoute('/settings/appearance')({
    component: AppearancePage,
});
