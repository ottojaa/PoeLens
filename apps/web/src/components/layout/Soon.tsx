import { cn } from '@/lib/utils';

/** A visible "soon" marker. Disabled controls get no hover events, so a tooltip would never show. */
export function Soon({ className }: { className?: string }) {
    return (
        <span className={cn('bg-secondary text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase', className)}>
            soon
        </span>
    );
}
