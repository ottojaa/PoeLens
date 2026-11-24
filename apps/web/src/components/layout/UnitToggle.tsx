import { UNIT_CHOICES, type UnitChoice } from '@poelens/shared';
import { motion } from 'motion/react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { SPRING } from '@/motion/tokens';
import { cn } from '@/lib/utils';

const SHORT_LABEL: Record<UnitChoice, string> = { auto: 'Auto', divine: 'div', exalted: 'ex', chaos: 'c' };

/**
 * Switches the unit prices are quoted in: Auto (each price in the unit it reads best in) or one fixed unit. Controlled: the economy context owns the value. Below `lg` the labels are
 * short (Auto / div / ex / c) so the control fits a phone's header; the buttons keep the full name for screen readers.
 */
export function UnitToggle({ value, onChange }: { value: UnitChoice; onChange: (unit: UnitChoice) => void }) {
    const pillId = useId();

    return (
        <div className="flex items-center gap-2">
            <div role="group" aria-label="Price unit" className="border-input bg-card flex gap-0.5 rounded-[10px] border p-[3px]">
                {UNIT_CHOICES.map((unit) => (
                    <Button
                        key={unit}
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={unit}
                        aria-pressed={unit === value}
                        onClick={() => onChange(unit)}
                        className={cn(
                            'relative h-8 rounded-lg px-2.5 lg:px-3 hover:bg-transparent dark:hover:bg-transparent',
                            unit === value ? 'text-primary-foreground hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {unit === value && (
                            <motion.span layoutId={pillId} transition={SPRING} className="bg-primary absolute inset-0 rounded-lg" aria-hidden="true" />
                        )}
                        <span className="relative lg:hidden">{SHORT_LABEL[unit]}</span>
                        <span className="relative hidden capitalize lg:inline">{unit}</span>
                    </Button>
                ))}
            </div>
        </div>
    );
}
