import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/lib/theme';
import { useMediaQuery } from '@/lib/use-media-query';

/** Toasts in the app's own tokens: bottom right beside the page, bottom centre on a phone. */
function Toaster(props: ToasterProps) {
    const { isDark } = useTheme();
    const isWide = useMediaQuery('(min-width: 768px)');

    return (
        <Sonner
            theme={isDark ? 'dark' : 'light'}
            position={isWide ? 'bottom-right' : 'bottom-center'}
            className="toaster group"
            style={
                {
                    '--normal-bg': 'var(--popover)',
                    '--normal-text': 'var(--popover-foreground)',
                    '--normal-border': 'var(--border)',
                    '--border-radius': 'var(--radius-lg)',
                } as CSSProperties
            }
            {...props}
        />
    );
}

export { Toaster };
