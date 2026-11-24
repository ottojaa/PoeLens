import type { Unit } from '@poelens/shared';
import { cn } from '@/lib/utils';
import { UNIT_LETTER } from './block-format';

const SIZES = { sm: 'size-4 rounded-[5px] text-[10px]', md: 'size-[22px] rounded-md text-xs' } as const;

/** A unit's small tile: the letter of the unit a price is quoted in. The unit's name is on the tile for screen readers. */
export function UnitMark({ unit, size = 'sm' }: { unit: Unit; size?: keyof typeof SIZES }) {
    return (
        <span
            role="img"
            aria-label={unit}
            className={cn('bg-secondary border-input text-primary inline-grid shrink-0 place-items-center border font-bold', SIZES[size])}
        >
            {UNIT_LETTER[unit]}
        </span>
    );
}
