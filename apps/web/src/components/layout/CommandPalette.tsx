import { useEffect } from 'react';
import { Command, CommandEmpty, CommandInput, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

/** Opens and closes the palette on Cmd+K and on Ctrl+K. */
export function useCommandShortcut(toggle: () => void) {
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;

            event.preventDefault();
            toggle();
        }

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [toggle]);
}

/** The search palette. Search itself arrives with the economy view, so for now it opens and says so. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="bg-card top-[110px] w-[min(680px,calc(100%-32px))] max-w-none translate-y-0 gap-0 rounded-2xl p-0 sm:max-w-none"
            >
                <DialogTitle className="sr-only">Search</DialogTitle>
                <DialogDescription className="sr-only">Search every currency and item</DialogDescription>
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Search every currency and item" />
                    <CommandList>
                        <CommandEmpty>Search arrives with the economy view.</CommandEmpty>
                    </CommandList>
                    <div className="text-muted-foreground flex items-center justify-end gap-2 border-t px-5 py-3 text-xs">
                        <span>Close</span>
                        <kbd className="border-input rounded-md border px-1.5 py-0.5 font-sans">Esc</kbd>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
