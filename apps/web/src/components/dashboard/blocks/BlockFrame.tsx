import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The shared spacing and divider of every block: a rule above each block, except after a heading and at the top. */
export function BlockFrame({ ruled, heading, children }: { ruled: boolean; heading?: boolean; children: ReactNode }) {
    return <div className={cn('relative px-3', heading ? 'pt-3 pb-1' : 'py-2.5', ruled && 'border-border border-t')}>{children}</div>;
}
