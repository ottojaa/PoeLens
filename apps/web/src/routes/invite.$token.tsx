import { MIN_PASSWORD_LENGTH } from '@poelens/shared';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import { Field } from '@/components/auth/Field';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useInvitePreview } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { toFormError } from '@/lib/api/error-message';
import { useAuth } from '@/lib/auth';

export const Route = createFileRoute('/invite/$token')({
    component: InvitePage,
});

const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters. A few random words work well.`;

function InvitePage() {
    const { token } = Route.useParams();
    const preview = useInvitePreview(token);

    if (preview.isPending) return <Skeleton className="mx-auto h-72 w-full max-w-sm" aria-busy="true" aria-label="Checking your invite" />;

    if (preview.isError && !(preview.error instanceof ApiError && preview.error.status === 410)) {
        return (
            <AuthCard title="Can't check this invite" description="The server didn't answer as expected. Your link may still be fine.">
                <Button variant="outline" onClick={() => void preview.refetch()}>
                    Try again
                </Button>
            </AuthCard>
        );
    }

    if (preview.isError) {
        return (
            <AuthCard title="This invite doesn't work" description="It was already used, revoked or has expired, or the link is incomplete. Ask for a new one.">
                <Link to="/login" className={buttonVariants({ variant: 'outline' })}>
                    Go to sign in
                </Link>
            </AuthCard>
        );
    }

    return <RegisterForm token={token} role={preview.data.role} />;
}

function RegisterForm({ token, role }: { token: string; role: 'admin' | 'member' }) {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const form = new FormData(event.currentTarget);

        setPending(true);
        setError(null);

        try {
            await register({
                token,
                email: String(form.get('email')),
                displayName: String(form.get('displayName')),
                password: String(form.get('password')),
            });
            await navigate({ to: '/' });
        } catch (caught) {
            setError(toFormError(caught));
        } finally {
            setPending(false);
        }
    }

    return (
        <AuthCard title="Create your account" description={role === 'admin' ? "You're invited as an admin." : "You've been invited to PoeLens."}>
            <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
                <Field id="email" name="email" label="Email" type="email" autoComplete="username" required autoFocus />
                <Field id="displayName" name="displayName" label="Display name" autoComplete="nickname" maxLength={60} required />
                <Field
                    id="password"
                    name="password"
                    label="Password"
                    type="password"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    hint={PASSWORD_HINT}
                    required
                />
                {error && (
                    <p role="alert" className="text-destructive text-sm">
                        {error}
                    </p>
                )}
                <Button type="submit" disabled={pending}>
                    {pending ? 'Creating account…' : 'Create account'}
                </Button>
            </form>
        </AuthCard>
    );
}
