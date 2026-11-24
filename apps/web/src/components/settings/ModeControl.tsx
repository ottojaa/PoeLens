import { COLOR_MODES, type ColorMode } from '@poelens/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LABELS: Record<ColorMode, string> = { dark: 'Dark', light: 'Light', system: 'System' };

/** Dark, Light, or follow the device. Controlled: the theme provider owns the value. */
export function ModeControl({ value, onChange }: { value: ColorMode; onChange: (mode: ColorMode) => void }) {
    return (
        <div role="group" aria-label="Colour mode" className="border-input bg-card inline-flex gap-0.5 rounded-[10px] border p-[3px]">
            {COLOR_MODES.map((mode) => (
                <Button
                    key={mode}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={mode === value}
                    onClick={() => onChange(mode)}
                    className={cn(
                        'h-8 rounded-lg px-4',
                        mode === value
                            ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground dark:hover:bg-primary'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {LABELS[mode]}
                </Button>
            ))}
        </div>
    );
}
