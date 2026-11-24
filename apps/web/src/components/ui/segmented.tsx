import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
    value: T;
    label: ReactNode;
    disabled?: boolean;
}

/** A row of buttons of which one is pressed: the editor's switch between a few choices. */
export function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
    className,
}: {
    label: string;
    value: T;
    options: readonly SegmentedOption<T>[];
    onChange: (value: T) => void;
    className?: string;
}) {
    return (
        <div role="group" aria-label={label} className={cn('border-input bg-card flex gap-0.5 rounded-[10px] border p-[3px]', className)}>
            {options.map((option) => (
                <Button
                    key={option.value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={option.value === value}
                    disabled={option.disabled}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'h-8 flex-1 rounded-lg px-3',
                        option.value === value
                            ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground dark:hover:bg-primary'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {option.label}
                </Button>
            ))}
        </div>
    );
}
