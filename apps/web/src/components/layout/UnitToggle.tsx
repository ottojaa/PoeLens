import { UNITS, type Unit } from '@poelens/shared';
import { motion } from 'motion/react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { SPRING } from '@/motion/tokens';
import { cn } from '@/lib/utils';
import { Soon } from './Soon';

/** Switches the currency prices are quoted in. Controlled: the economy view will own the value. */
export function UnitToggle({ value, onChange, disabled = false }: { value: Unit; onChange: (unit: Unit) => void; disabled?: boolean }) {
    const pillId = useId();

    return (
        <div className="flex items-center gap-2">
            <div role="group" aria-label="Price unit" className="border-input bg-card flex gap-0.5 rounded-[10px] border p-[3px]">
                {UNITS.map((unit) => (
                    <Button
                        key={unit}
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        aria-pressed={unit === value}
                        onClick={() => onChange(unit)}
                        className={cn(
                            'relative h-8 rounded-lg px-3 capitalize hover:bg-transparent disabled:opacity-60 dark:hover:bg-transparent',
                            unit === value ? 'text-primary-foreground hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {unit === value && (
                            <motion.span layoutId={pillId} transition={SPRING} className="bg-primary absolute inset-0 rounded-lg" aria-hidden="true" />
                        )}
                        <span className="relative">{unit}</span>
                    </Button>
                ))}
            </div>
            {disabled && <Soon />}
        </div>
    );
}
