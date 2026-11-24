import { MAX_DASHBOARD_NAME } from '@poelens/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

/** Asks for a dashboard's name: when adding a tab and when renaming one. Mounted only while open, so it starts from `initial` each time. */
export function NameDialog({
    title,
    submitLabel,
    initial,
    pending,
    error,
    onSubmit,
    onClose,
}: {
    title: string;
    submitLabel: string;
    initial: string;
    pending: boolean;
    error?: string;
    onSubmit: (name: string) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(initial);
    const trimmed = name.trim();

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (trimmed) onSubmit(trimmed);
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>Shown on its tab.</DialogDescription>
                    </DialogHeader>
                    <Input aria-label="Dashboard name" value={name} maxLength={MAX_DASHBOARD_NAME} autoFocus onChange={(event) => setName(event.target.value)} />
                    {error && (
                        <p role="alert" className="text-destructive text-sm">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!trimmed || pending}>
                            {submitLabel}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Confirms deleting a dashboard, which takes its panels with it. */
export function DeleteDialog({ name, pending, onConfirm, onClose }: { name: string; pending: boolean; onConfirm: () => void; onClose: () => void }) {
    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete {name}?</DialogTitle>
                    <DialogDescription>Its panels go with it. This can't be undone.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
