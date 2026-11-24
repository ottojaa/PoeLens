import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';
import { TogglePop } from '@/motion/TogglePop';

export function ThemeToggle() {
    const { isDark, setIsDark } = useTheme();

    return (
        <Button variant="ghost" size="icon" aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setIsDark((prev) => !prev)}>
            <TogglePop state={isDark}>{isDark ? <Sun /> : <Moon />}</TogglePop>
        </Button>
    );
}
