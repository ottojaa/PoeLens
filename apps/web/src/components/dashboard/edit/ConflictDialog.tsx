import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Shown when a save was refused because the dashboard was saved elsewhere meanwhile: the user picks whose version stays. */
export function ConflictDialog({ open, saving, onReload, onOverwrite }: { open: boolean; saving: boolean; onReload: () => void; onOverwrite: () => void }) {
    return (
        <Dialog open={open}>
            <DialogContent showCloseButton={false} onEscapeKeyDown={(event) => event.preventDefault()} onInteractOutside={(event) => event.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>This dashboard changed in another tab</DialogTitle>
                    <DialogDescription>
                        It was saved somewhere else since you started editing. Reload to get that version and drop your edits, or overwrite it with yours.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onReload} disabled={saving}>
                        Reload
                    </Button>
                    <Button type="button" onClick={onOverwrite} disabled={saving}>
                        Overwrite
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
