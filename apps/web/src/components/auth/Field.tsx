import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** A labelled input. `hint` is read out with the input, so a password rule is not only visible on screen. */
export function Field({ label, hint, id, ...props }: ComponentProps<typeof Input> & { label: string; hint?: string; id: string }) {
    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} aria-describedby={hint ? id + '-hint' : undefined} {...props} />
            {hint && (
                <p id={id + '-hint'} className="text-muted-foreground text-xs">
                    {hint}
                </p>
            )}
        </div>
    );
}
