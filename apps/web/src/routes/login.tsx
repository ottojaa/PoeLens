import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import { Field } from '@/components/auth/Field';
import { Button } from '@/components/ui/button';
import { toFormError } from '@/lib/api/error-message';
import { useAuth } from '@/lib/auth';

export const Route = createFileRoute('/login')({
    component: LoginPage,
});

function LoginPage() {
    const { signIn } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const form = new FormData(event.currentTarget);

        setPending(true);
        setError(null);

        try {
            await signIn(String(form.get('email')), String(form.get('password')));
            await navigate({ to: '/' });
        } catch (caught) {
            setError(toFormError(caught));
        } finally {
            setPending(false);
        }
    }

    return (
        <AuthCard title="Sign in" description="PoeLens is invite-only. Ask the person who runs it for an invite link.">
            <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
                <Field id="email" name="email" label="Email" type="email" autoComplete="username" required autoFocus />
                <Field id="password" name="password" label="Password" type="password" autoComplete="current-password" required />
                {error && (
                    <p role="alert" className="text-destructive text-sm">
                        {error}
                    </p>
                )}
                <Button type="submit" disabled={pending}>
                    {pending ? 'Signing in…' : 'Sign in'}
                </Button>
            </form>
        </AuthCard>
    );
}
