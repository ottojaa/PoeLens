import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemePreview } from './ThemePreview';

/** One theme: its live preview and name. Pressing it picks the theme. */
export function ThemeCard({ id, label, selected, isDark, onSelect }: { id: string; label: string; selected: boolean; isDark: boolean; onSelect: () => void }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className={cn(
                'bg-card focus-visible:ring-ring flex flex-col gap-3 rounded-xl border p-3 text-left outline-none focus-visible:ring-2',
                selected ? 'border-primary ring-primary ring-2' : 'border-border hover:border-input',
            )}
        >
            <ThemePreview theme={id} isDark={isDark} />
            <span className="flex items-center justify-between px-1 text-sm font-medium">
                {label}
                {selected && <Check className="text-primary size-4" aria-hidden="true" />}
            </span>
        </button>
    );
}
