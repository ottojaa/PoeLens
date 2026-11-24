import { formatChange, toChangeDirection, type ChangeDirection } from '@/lib/format';
import { cn } from '@/lib/utils';

export const CHANGE_TEXT_CLASS: Record<ChangeDirection, string> = {
    up: 'text-up',
    down: 'text-down',
    flat: 'text-muted-foreground',
};

/** A percent change in the up or down colour, always with its arrow, so the direction never rests on colour alone. */
export function Change({ percent, className }: { percent: number | null; className?: string }) {
    return <span className={cn('font-semibold whitespace-nowrap', CHANGE_TEXT_CLASS[toChangeDirection(percent)], className)}>{formatChange(percent)}</span>;
}
