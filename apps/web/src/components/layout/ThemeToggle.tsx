import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';
import { TogglePop } from '@/motion/TogglePop';

export function ThemeToggle({ className }: { className?: string }) {
    const { isDark, toggleDark } = useTheme();

    return (
        <Button variant="ghost" size="icon" className={className} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleDark}>
            <TogglePop state={isDark}>{isDark ? <Sun /> : <Moon />}</TogglePop>
        </Button>
    );
}
