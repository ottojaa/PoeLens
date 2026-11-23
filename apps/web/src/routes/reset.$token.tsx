import { MIN_PASSWORD_LENGTH } from '@poelens/shared';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import { Field } from '@/components/auth/Field';
import { Button, buttonVariants } from '@/components/ui/button';
import { postReset } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { toFormError } from '@/lib/api/error-message';

export const Route = createFileRoute('/reset/$token')({
    component: ResetPage,
});

function ResetPage() {
    const { token } = Route.useParams();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [linkDead, setLinkDead] = useState(false);

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const form = new FormData(event.currentTarget);

        setPending(true);
        setError(null);

        try {
            await postReset(token, String(form.get('password')));
            await navigate({ to: '/login' });
        } catch (caught) {
            if (caught instanceof ApiError && caught.status === 410) setLinkDead(true);
            else setError(toFormError(caught));
        } finally {
            setPending(false);
        }
    }

    if (linkDead) {
        return (
            <AuthCard title="This link doesn't work" description="It was already used or has expired. Ask the admin for a new one.">
                <Link to="/login" className={buttonVariants({ variant: 'outline' })}>
                    Go to sign in
                </Link>
            </AuthCard>
        );
    }

    return (
        <AuthCard title="Choose a new password" description="You'll be signed out everywhere and can sign in with the new password.">
            <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
                <Field
                    id="password"
                    name="password"
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                    required
                    autoFocus
                />
                {error && (
                    <p role="alert" className="text-destructive text-sm">
                        {error}
                    </p>
                )}
                <Button type="submit" disabled={pending}>
                    {pending ? 'Saving…' : 'Set password'}
                </Button>
            </form>
        </AuthCard>
    );
}
