import { cn } from '@/lib/utils';

/** The magnifying-glass mark, drawn in the accent colour (the same drawing as public/favicon.svg). */
export function LogoMark({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('text-primary size-6', className)}>
            <circle cx="13.5" cy="13.5" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="13.5" cy="13.5" r="4" fill="currentColor" />
            <path d="M20.5 20.5 L28 28" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
    );
}

export function Wordmark({ className }: { className?: string }) {
    return (
        <span className={cn('flex items-center gap-2.5', className)}>
            <LogoMark />
            <span className="font-heading text-xl font-bold tracking-tight">PoeLens</span>
        </span>
    );
}
