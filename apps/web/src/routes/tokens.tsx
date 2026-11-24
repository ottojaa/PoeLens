import { createFileRoute } from '@tanstack/react-router';
import { TokensPage } from '@/components/tokens/TokensPage';

export const Route = createFileRoute('/tokens')({
    component: TokensPage,
});
