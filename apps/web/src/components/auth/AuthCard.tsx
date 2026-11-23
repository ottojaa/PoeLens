import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** The frame of the sign-in, invite and reset pages. */
export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return (
        <Card className="mx-auto w-full max-w-sm">
            <CardHeader>
                <CardTitle role="heading" aria-level={1} className="text-xl">
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}
