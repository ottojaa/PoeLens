import type { ApiToken } from '@poelens/shared';
import { formatAgo, formatDate } from '@/lib/format';
import { RevokeDialog } from './RevokeDialog';

function TokenRow({ token }: { token: ApiToken }) {
    return (
        <li className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
                <p className="truncate font-semibold">{token.name}</p>
                <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    <code className="font-mono">{token.prefix}…</code>
                    <span>Created {formatDate(token.createdAt)}</span>
                    <span>{token.lastUsedAt ? `Last used ${formatAgo(token.lastUsedAt)}` : 'Never used'}</span>
                </p>
            </div>
            <div>
                <RevokeDialog token={token} />
            </div>
        </li>
    );
}

export function TokenList({ tokens }: { tokens: readonly ApiToken[] }) {
    return (
        <ul aria-label="Your tokens" className="bg-card divide-y rounded-xl border">
            {tokens.map((token) => (
                <TokenRow key={token.id} token={token} />
            ))}
        </ul>
    );
}
