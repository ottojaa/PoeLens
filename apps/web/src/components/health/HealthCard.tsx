import { type HealthResponse } from '@poelens/shared';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useHealth } from '@/lib/api/health';
import { formatUptime } from '@/lib/format';

const STATUS_TONE = {
    ok: 'border-success/40 bg-success/10 text-success',
    degraded: 'border-warning/50 bg-warning/10 text-warning',
} as const;

function StatusBadge({ status }: { status: HealthResponse['status'] | HealthResponse['services']['database'] }) {
    const tone = status === 'ok' ? STATUS_TONE.ok : STATUS_TONE.degraded;

    return (
        <Badge variant="outline" className={tone}>
            {status}
        </Badge>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-muted-foreground text-sm">{label}</dt>
            <dd className="text-sm font-medium">{children}</dd>
        </div>
    );
}

export function HealthCard() {
    const { data, isPending, isError, refetch, isFetching } = useHealth();

    return (
        <Card className="max-w-md">
            <CardHeader>
                <CardTitle>API status</CardTitle>
                <CardDescription>Checked every 30 seconds.</CardDescription>
            </CardHeader>
            <CardContent>
                {isPending && (
                    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading API status">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-3/4" />
                    </div>
                )}

                {isError && (
                    <div className="flex flex-col items-start gap-3" role="alert">
                        <p className="text-sm">Can't reach the API.</p>
                        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
                            Try again
                        </Button>
                    </div>
                )}

                {/* Query keeps the last data after a failed refetch; showing it beside the error would read as current. */}
                {data && !isError && (
                    <dl className="divide-y">
                        <Row label="API">
                            <StatusBadge status={data.status} />
                        </Row>
                        <Row label="Database">
                            <StatusBadge status={data.services.database} />
                        </Row>
                        <Row label="Version">{data.version}</Row>
                        <Row label="Uptime">{formatUptime(data.uptime)}</Row>
                    </dl>
                )}
            </CardContent>
        </Card>
    );
}
